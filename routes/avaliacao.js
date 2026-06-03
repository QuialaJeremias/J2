const express = require("express");
const router = express.Router();
const db = require("../database/connection");

router.get("/resultado", (req, res) => {

    const area = req.query.area;

    const sql = "SELECT * FROM cursos WHERE area = ?";

    db.query(sql, [area], (err, result) => {

        if (err) throw err;

        res.render("resultados/resultado", { cursos: result });

    });

});

module.exports = router;