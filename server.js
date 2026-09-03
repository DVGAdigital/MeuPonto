const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Meu Ponto - servidor online");
});

app.post("/webhook", (req, res) => {
    console.log("Webhook Mercado Pago:", req.body);

    res.sendStatus(200);
});

app.get("/status", (req, res) => {
    res.json({
        servidor: "online",
        mercadoPago: !!process.env.MERCADOPAGO_ACCESS_TOKEN
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});