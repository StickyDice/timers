const { hash } = require("../externalFunctions");

module.exports = {
  // eslint-disable-next-line no-unused-vars
  async up(db, client) {
    await db.collection("users").insertOne({
      username: "admin",
      password: hash("pwd007"),
    });
  },

  // eslint-disable-next-line no-unused-vars
  async down(db, client) {
    await db.collection("users").deleteOne({
      username: "admin",
    });
  },
};
