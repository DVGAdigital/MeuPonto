const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

let colecaoPagamentos;

const clienteMongo = new MongoClient(MONGODB_URI);

async function conectarBanco() {

    try {

        await clienteMongo.connect();

        const banco = clienteMongo.db("meuponto");

        colecaoPagamentos = banco.collection("pagamentos");

        console.log("Conectado ao MongoDB com sucesso!");

    } catch (erro) {

        console.error("ERRO ao conectar no MongoDB:", erro.message);
    }
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

app.post("/webhook", async (req, res) => {

    try {

        console.log("Webhook recebido:", req.body);

        const tipoNotificacao = req.query.type || req.body.type;

        const pagamentoId =
            req.query["data.id"] ||
            (req.body.data && req.body.data.id);

        if (tipoNotificacao !== "payment" || !pagamentoId) {

            return res.sendStatus(200);
        }

        // Busca os detalhes reais do pagamento na API do Mercado Pago
        const resposta = await fetch(
            `https://api.mercadopago.com/v1/payments/${pagamentoId}`,
            {
                headers: {
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                }
            }
        );

        const pagamento = await resposta.json();

        console.log("Detalhes do pagamento:", pagamento);

        if (pagamento.status === "approved") {

            const referencia = pagamento.external_reference || "";

            const [dispositivoId, tipoPlano] = referencia.split("|");

            if (dispositivoId) {

                const agora = new Date();
                const validoAte = new Date(agora);

                if (tipoPlano === "mensal") {

                    validoAte.setMonth(validoAte.getMonth() + 1);

                } else if (tipoPlano === "anual") {

                    validoAte.setFullYear(validoAte.getFullYear() + 1);
                }

                await colecaoPagamentos.updateOne(
                    { dispositivoId: dispositivoId },
                    {
                        $set: {
                            dispositivoId: dispositivoId,
                            plano: tipoPlano,
                            status: "aprovado",
                            pagamentoId: pagamentoId,
                            validoAte: validoAte,
                            atualizadoEm: agora
                        }
                    },
                    { upsert: true }
                );

                console.log(
                    "PRO liberado para:",
                    dispositivoId
                );
            }
        }

        res.sendStatus(200);

    } catch (erro) {

        console.error("Erro no webhook:", erro);

        res.sendStatus(200);
        // Sempre responde 200 para o Mercado Pago não ficar reenviando
    }

});


// ===============================
// VERIFICAR PAGAMENTO
// ===============================

app.get("/verificar-pagamento/:dispositivoId", async (req, res) => {

    try {

        const { dispositivoId } = req.params;

        const registro = await colecaoPagamentos.findOne({
            dispositivoId: dispositivoId
        });

        const pro =
            !!registro && registro.status === "aprovado";

        res.json({ pro: pro });

    } catch (erro) {

        console.error("Erro ao verificar pagamento:", erro);

        res.status(500).json({ erro: "Erro interno" });

    }

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