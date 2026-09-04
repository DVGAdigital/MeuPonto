const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();

app.use(express.json());

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

let colecaoPagamentos;

const clienteMongo = new MongoClient(MONGODB_URI);

async function conectarBanco() {

    await clienteMongo.connect();

    const banco = clienteMongo.db("meuponto");

    colecaoPagamentos = banco.collection("pagamentos");

    console.log("Conectado ao MongoDB");
}

conectarBanco();


// ===============================
// SERVIDOR
// ===============================

app.get("/", (req, res) => {
    res.send("Meu Ponto - servidor online");
});


// ===============================
// STATUS
// ===============================

app.get("/status", (req, res) => {
    res.json({
        servidor: "online",
        mercadoPago: !!ACCESS_TOKEN
    });
});


// ===============================
// CRIAR PAGAMENTO
// ===============================

app.post("/criar-pagamento", async (req, res) => {

    try {

        const { tipo, dispositivoId } = req.body;

        if (!dispositivoId) {

            return res.status(400).json({
                erro: "dispositivoId não informado"
            });
        }

        let valor;
        let titulo;

        if (tipo === "mensal") {

            valor = 3.49;
            titulo = "Meu Ponto PRO - Mensal";

        } else if (tipo === "anual") {

            valor = 34.99;
            titulo = "Meu Ponto PRO - Anual";

        } else {

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

                    external_reference: `${dispositivoId}|${tipo}`

                })

            }
        );


        const dados = await resposta.json();


        if (!resposta.ok) {

            console.log(
                "Erro Mercado Pago:",
                dados
            );

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

        console.error(
            "Erro interno:",
            erro
        );

        res.status(500).json({

            erro: "Erro interno do servidor"

        });

    }

});


// ===============================
// WEBHOOK MERCADO PAGO
// ===============================

app.post("/webhook", (req, res) => {

    console.log(
        "Webhook Mercado Pago:",
        req.body
    );

    res.sendStatus(200);

});


// ===============================
// INICIAR SERVIDOR
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Servidor rodando na porta ${PORT}`
    );

});