require("dotenv").config();
const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const { nanoid } = require("nanoid");

const hash = (d) => crypto.createHash("sha256").update(d).digest("hex");

async function getUserData(db, username) {
  return await db.collection("users").findOne({ username });
}

async function getUserDataById(db, _id) {
  return await db.collection("users").findOne({ _id });
}

async function getUserDataBySessionId(db, sessionId) {
  const userId = await db.collection("sessions").findOne(
    {
      _id: new ObjectId(sessionId),
    },
    {
      userId: 1,
    }
  );
  if (!userId) {
    return;
  }
  return await db.collection("users").findOne({ _id: userId.userId });
}

async function createSession(db, userId) {
  const res = await db.collection("sessions").insertOne({ userId });
  return res.insertedId;
}

async function deleteSession(db, sessionId) {
  await db.collection("sessions").deleteOne({ _id: new ObjectId(sessionId) });
}

const auth = () => async (req, res, next) => {
  if (!req.cookies["sessionId"]) {
    return next();
  }
  req.user = await getUserDataBySessionId(req.db, req.cookies["sessionId"]);
  req.sessionId = req.cookies["sessionId"];
  next();
};

async function createUser(db, username, password) {
  const res = await db.collection("users").insertOne(
    {
      username,
      password: hash(password),
    },
    {
      projection: { _id: 1 },
    }
  );
  return res.insertedId;
}

async function createToken(db, userId) {
  const token = nanoid();
  await db.collection("token").insertOne({ token, userId });
  return token;
}

async function getToken(db, userId) {
  return await db.collection("token").findOne({
    userId: new ObjectId(userId),
  }).then(res => res.token);
}

async function deleteToken(db, token) {
  await db.collection("token").deleteOne({ token });
}

async function getUserIdByToken(db, token) {
  return await db
    .collection("token")
    .findOne(
      {
        token,
      },
      {
        token: 0,
      }
    )
    .then((res) => res.userId);
}

async function getTimers(db, userId) {
  return await db.collection("timers").find({ user_id: userId }).toArray();
}

async function getActiveTimers(db, userId) {
  return await db.collection("timers").find({ user_id: userId, isActive: true }).toArray();
}


module.exports = {
  getUserData,
  createSession,
  deleteSession,
  auth,
  hash,
  createUser,
  createToken,
  deleteToken,
  getUserIdByToken,
  getUserDataById,
  getTimers,
  getActiveTimers,
  getToken,
};
