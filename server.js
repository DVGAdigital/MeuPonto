const express = require("express");

const app = express();

app.use(express.json());

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

app.get("/", (req, res) => {
    res.send("Meu Ponto - servidor online");
});

app.get("/status", (req, res) => {
    res.json({
        servidor: "online",
        mercadoPago: !!ACCESS_TOKEN
    });
});

// CRIAR PAGAMENTO
app.post("/criar-pagamento", async (req, res) => {

    try {

        const { tipo } = req.body;

        let valor;
        let titulo;

        if (tipo === "mensal") {
            valor = 3.49;
            titulo = "Meu Ponto PRO - Mensal";
        } 
        else if (tipo === "anual") {
            valor = 34.99;
            titulo = "Meu Ponto PRO - Anual";
        } 
        else {
            return res.status(400).json({
                erro: "Plano inválido"
            });
        }

        const resposta = await fetch(
            "https://api.mercadopago.com/checkout/preferences",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                },

                body: JSON.stringify({

                    items: [
                        {
                            title: titulo,
                            quantity: 1,
                            currency_id: "BRL",
                            unit_price: valor
                        }
                    ],

                    payment_methods: {
                        excluded_payment_types: []
                    },

                    back_urls: {
                        success: "https://dvgadigital.github.io/MeuPonto/",
                        failure: "https://dvgadigital.github.io/MeuPonto/",
                        pending: "https://dvgadigital.github.io/MeuPonto/"
                    },

                    auto_return: "approved",

                    external_reference: `meu-ponto-${tipo}`

                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            console.log("Erro Mercado Pago:", dados);

            return res.status(resposta.status).json({
                erro: "Erro ao criar pagamento",
                detalhes: dados
            });
        }

        res.json({
            sucesso: true,
            id: dados.id,
            link: dados.init_point
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro interno do servidor"
        });
    }
});


// WEBHOOK
app.post("/webhook", (req, res) => {

    console.log("Webhook Mercado Pago:", req.body);

    res.sendStatus(200);
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});