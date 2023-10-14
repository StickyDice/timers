require("dotenv").config();
const express = require("express");

const router = express.Router();
const { auth } = require("./externalFunctions.js");
const { ObjectId } = require("mongodb");

router.get("/", auth(), async (req, res) => {
  const db = req.db;
  const isActive = req.query.isActive;
  let activeTimers = await db
    .collection("timers")
    .find({ isActive: isActive === "true" })
    .toArray();
  activeTimers = activeTimers.filter(
    (timer) => timer.isActive.toString() === isActive && timer.user_id.toString() === req.user._id.toString()
  );
  if (isActive === "true") {
    activeTimers.forEach((timer) => {
      timer.progress = Date.now() - Number(timer.start);
      timer.start = Number(timer.start);
    });
  } else {
    activeTimers.forEach((timer) => {
      timer.start = Number(timer.start);
      timer.end = Number(timer.end);
    });
  }

  res.json(activeTimers);
});

router.post("/", auth(), async (req, res) => {
  const db = req.db;
  const id = await db.collection("timers").insertOne(
    {
      start: Date.now(),
      description: req.body.description,
      isActive: true,
      user_id: req.user._id,
    },
    {
      projection: { _id: 1 },
    }
  );
  res.json({ id: id.insertedId.toString() });
});

router.post("/:id/stop", async (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const startTime = await db.collection("timers").findOne(
    {
      _id: new ObjectId(id),
    },
    { projection: { start: 1 } }
  );
  await db.collection("timers").updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $set: {
        isActive: false,
        duration: Date.now() - startTime.start,
        end: Date.now(),
      },
    }
  );
  res.json({ id });
});

module.exports = router;
