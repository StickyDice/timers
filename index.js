const express = require("express");
const bodyParser = require("body-parser");
const nunjucks = require("nunjucks");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const {
  createSession,
  getUserData,
  deleteSession,
  auth,
  createUser,
  createToken,
  deleteToken,
  getUserIdByToken,
  getTimers,
  getActiveTimers,
  getToken,
} = require("./externalFunctions");
const { MongoClient } = require("mongodb");
const WebSocket = require("ws");
const http = require("http");
const cookie = require("cookie");

const clientPromise = MongoClient.connect(process.env.DB_URI);

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.WebSocketServer({ clientTracking: false, noServer: true });
const clients = new Map();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("app");
    next();
  } catch (err) {
    next(err);
  }
});

const hash = (d) => crypto.createHash("sha256").update(d).digest("hex");

app.get("/", auth(), async (req, res) => {
  let token;
  if (req.user) {
    token = await getToken(req.db, req.user._id);
  }
  res.render("index", {
    user: req.user,
    userToken: token,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;

  const user = await getUserData(req.db, username);
  if (!user || user.password !== hash(password)) {
    return res.redirect("/?authError=true");
  }
  const sessionId = await createSession(req.db, user._id);
  const token = await createToken(req.db, user._id);
  res.cookie("token", token);
  res.cookie("sessionId", sessionId.toString(), { httpOnly: true }).redirect("/");
});

app.get("/logout", auth(), async (req, res) => {
  if (!req.user) {
    res.redirect("/");
  }
  await deleteSession(req.db, req.sessionId);
  await deleteToken(req.db, req.cookies["token"]);
  res.clearCookie("token");
  res.clearCookie("sessionId").redirect("/");
});

app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect("/?authError=true");
  }
  const id = await createUser(req.db, username, password);
  const sessionId = await createSession(req.db, id);
  const token = await createToken(req.db, id);
  res.cookie("token", token);
  res.cookie("sessionId", sessionId.toString(), { httpOnly: true }).redirect("/");
});

app.use("/api/timers", require("./timers"));

server.on("upgrade", async (req, socket, head) => {
  const client = await clientPromise;
  req.db = client.db("app");

  const cookies = cookie.parse(req.headers["cookie"]);
  const token = cookies && cookies["token"];
  const userId = token && (await getUserIdByToken(req.db, token));
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return null;
  }

  req.userId = userId;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  // const token = cookie.parse(req.headers["cookie"])["token"];
  const { userId } = req;
  clients.set(userId, ws);

  ws.on("close", () => {
    clients.delete(userId);
  });

  ws.addEventListener("open", () => {
    console.log("asdhkfjlabsdjfhklasnmdbhfjsdaf")
  })

  ws.on("message", async (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      return null;
    }
    if (data.type === "all_timers") {
      const timers = await getTimers(req.db, userId);
      ws.send(
        JSON.stringify({
          type: "all_timers",
          timers,
        })
      );
    }
    if (data.type === "active_timers") {
      const timers = await getActiveTimers(req.db, userId);
      ws.send(
        JSON.stringify({
          type: "active_timers",
          timers,
        })
      );
    }
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Listening on http://localhost:${80}`);
});
