const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Meu Ponto - servidor online");
});

app.post("/webhook", (req, res) => {
    console.log("Webhook recebido:", req.body);

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});