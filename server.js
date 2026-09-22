const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

let colecaoPagamentos;
let colecaoDownloads;
let colecaoUsuarios;

const clienteMongo = new MongoClient(MONGODB_URI);

async function conectarBanco() {

    try {

        await clienteMongo.connect();

        const banco = clienteMongo.db("meuponto");

        colecaoPagamentos = banco.collection("pagamentos");
        colecaoDownloads = banco.collection("downloads");
        colecaoUsuarios = banco.collection("usuarios");

        console.log("Conectado ao MongoDB com sucesso!");

    } catch (erro) {

        console.error(
            "ERRO ao conectar no MongoDB:",
            erro.message
        );

    }

}


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
// VERSÃO DO APP
// ===============================

app.get("/versao-app", (req, res) => {

    res.json({

        versao: "1.0.1",

        apk:
            "https://github.com/DVGAdigital/MeuPonto/releases/latest/download/MeuPonto.apk"

    });

});


// ===============================
// DOWNLOAD DO APK
// ===============================

app.get("/download", async (req, res) => {

    try {

        await colecaoDownloads.insertOne({

            data: new Date(),

            origem:
                req.query.origem || "site"

        });

        console.log("Download registrado");

    } catch (erro) {

        console.error(
            "Erro ao registrar download:",
            erro.message
        );

    }

    res.redirect(
        "https://github.com/DVGAdigital/MeuPonto/releases/latest/download/MeuPonto.apk"
    );

});


// ===============================
// PAINEL
// ===============================

app.get("/painel", async (req, res) => {

    try {

        const agora = new Date();


        // =========================
        // INÍCIO DO DIA
        // =========================

        const inicioHoje = new Date(agora);

        inicioHoje.setHours(0, 0, 0, 0);


        // =========================
        // INÍCIO DO MÊS
        // =========================

        const inicioMes = new Date(

            agora.getFullYear(),

            agora.getMonth(),

            1

        );


        // =========================
        // DOWNLOADS
        // =========================

        const totalDownloads =
            await colecaoDownloads.countDocuments();


        const downloadsHoje =
            await colecaoDownloads.countDocuments({

                data: {
                    $gte: inicioHoje
                }

            });


        const downloadsMes =
            await colecaoDownloads.countDocuments({

                data: {
                    $gte: inicioMes
                }

            });


        // =========================
        // PRIMEIRAS ABERTURAS
        // =========================

        const totalUsuarios =
            await colecaoUsuarios.countDocuments();


        const usuariosHoje =
            await colecaoUsuarios.countDocuments({

                primeiraAbertura: {
                    $gte: inicioHoje
                }

            });


        const usuariosMes =
            await colecaoUsuarios.countDocuments({

                primeiraAbertura: {
                    $gte: inicioMes
                }

            });


        // =========================
        // ÚLTIMOS 7 DIAS
        // =========================

        const dias = [];


        for (let i = 6; i >= 0; i--) {

            const inicio = new Date(agora);

            inicio.setHours(0, 0, 0, 0);

            inicio.setDate(
                inicio.getDate() - i
            );


            const fim = new Date(inicio);

            fim.setDate(
                fim.getDate() + 1
            );


            // Downloads do dia

            const downloads =
                await colecaoDownloads.countDocuments({

                    data: {

                        $gte: inicio,

                        $lt: fim

                    }

                });


            // Primeiras aberturas do dia

            const usuarios =
                await colecaoUsuarios.countDocuments({

                    primeiraAbertura: {

                        $gte: inicio,

                        $lt: fim

                    }

                });


            dias.push({

                data:
                    inicio.toLocaleDateString(
                        "pt-BR",
                        {
                            day: "2-digit",
                            month: "2-digit"
                        }
                    ),

                downloads:
                    downloads,

                usuarios:
                    usuarios

            });

        }


        // =========================
        // LINHAS DO GRÁFICO
        // =========================

        let linhas = "";


        dias.forEach((dia) => {

            linhas += `

                <div class="linha-dia">

                    <span>
                        ${dia.data}
                    </span>

                    <strong>
                        ${dia.downloads}
                    </strong>

                    <strong>
                        ${dia.usuarios}
                    </strong>

                </div>

            `;

        });


        // =========================
        // PAINEL HTML
        // =========================

        res.send(`

<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    Meu Ponto — Painel
</title>


<style>

*{
    box-sizing:border-box;
}


body{

    margin:0;

    padding:25px;

    background:#0b1220;

    color:#fff;

    font-family:
        Arial,
        sans-serif;

}


.container{

    max-width:900px;

    margin:auto;

}


h1{

    margin:0;

}


.sub{

    color:#9ca7b8;

    margin-top:6px;

    margin-bottom:30px;

}


/* =========================
   CARDS
========================= */

.cards{

    display:grid;

    grid-template-columns:
        repeat(3,1fr);

    gap:15px;

}


.card{

    background:#111b2d;

    border:
        1px solid #26344d;

    border-radius:16px;

    padding:22px;

}


.card span{

    color:#9ca7b8;

    font-size:13px;

}


.card strong{

    display:block;

    margin-top:8px;

    font-size:34px;

    color:#ffc44d;

}


/* =========================
   TABELA
========================= */

.secao{

    margin-top:20px;

    background:#111b2d;

    border:
        1px solid #26344d;

    border-radius:16px;

    padding:25px;

}


.secao h2{

    margin-top:0;

}


.tabela{

    margin-top:20px;

}


.cabecalho,
.linha-dia{

    display:grid;

    grid-template-columns:
        1fr 1fr 1fr;

    padding:12px 0;

    border-bottom:
        1px solid #26344d;

}


.cabecalho{

    color:#9ca7b8;

    font-size:12px;

}


.linha-dia{

    font-size:14px;

}


.linha-dia strong{

    color:#ffc44d;

}


/* =========================
   BOTÃO
========================= */

.botao{

    display:inline-block;

    margin-top:20px;

    padding:12px 18px;

    border-radius:10px;

    background:#f6a800;

    color:#0b1220;

    text-decoration:none;

    font-weight:bold;

}


/* =========================
   CELULAR
========================= */

@media(max-width:650px){

    body{

        padding:18px;

    }


    .cards{

        grid-template-columns:1fr;

    }

}

</style>

</head>


<body>


<div class="container">


<h1>
    📊 Meu Ponto
</h1>


<div class="sub">

    Painel de acompanhamento do aplicativo

</div>


<!-- PRIMEIRA LINHA -->

<div class="cards">


    <div class="card">

        <span>
            📥 Total de downloads
        </span>

        <strong>
            ${totalDownloads}
        </strong>

    </div>


    <div class="card">

        <span>
            📱 Primeiras aberturas
        </span>

        <strong>
            ${totalUsuarios}
        </strong>

    </div>


    <div class="card">

        <span>
            📅 Downloads este mês
        </span>

        <strong>
            ${downloadsMes}
        </strong>

    </div>


</div>


<!-- SEGUNDA LINHA -->

<div
    class="cards"
    style="margin-top:15px"
>


    <div class="card">

        <span>
            📥 Downloads hoje
        </span>

        <strong>
            ${downloadsHoje}
        </strong>

    </div>


    <div class="card">

        <span>
            📱 Novas aberturas hoje
        </span>

        <strong>
            ${usuariosHoje}
        </strong>

    </div>


    <div class="card">

        <span>
            📱 Novas aberturas este mês
        </span>

        <strong>
            ${usuariosMes}
        </strong>

    </div>


</div>


<!-- ÚLTIMOS 7 DIAS -->

<div class="secao">


<h2>
    Últimos 7 dias
</h2>


<div class="tabela">


<div class="cabecalho">

    <span>
        Data
    </span>

    <span>
        Downloads
    </span>

    <span>
        Primeiras aberturas
    </span>

</div>


${linhas}


</div>


<a
    class="botao"
    href="/painel"
>

    ↻ Atualizar dados

</a>


</div>


</div>


</body>

</html>

        `);


    } catch (erro) {

        console.error(
            "Erro no painel:",
            erro
        );

        res
            .status(500)
            .send(
                "Erro ao carregar painel."
            );

    }

});


// ===============================
// PRIMEIRA ABERTURA DO APP
// ===============================

app.post("/registrar-abertura", async (req, res) => {

    try {

        const {
            dispositivoId
        } = req.body;


        if (!dispositivoId) {

            return res
                .status(400)
                .json({

                    erro:
                        "dispositivoId não informado"

                });

        }


        const agora =
            new Date();


        const resultado =
            await colecaoUsuarios.updateOne(

                {
                    dispositivoId:
                        dispositivoId
                },

                {

                    $set: {

                        ultimaAbertura:
                            agora

                    },

                    $setOnInsert: {

                        dispositivoId:
                            dispositivoId,

                        primeiraAbertura:
                            agora

                    }

                },

                {
                    upsert: true
                }

            );


        res.json({

            sucesso: true,

            novoUsuario:
                resultado.upsertedCount > 0

        });


    } catch (erro) {

        console.error(

            "Erro ao registrar abertura:",

            erro

        );


        res
            .status(500)
            .json({

                erro:
                    "Erro interno"

            });

    }

});


// ===============================
// CRIAR PAGAMENTO
// ===============================

app.post("/criar-pagamento", async (req, res) => {

    try {

        const {
            tipo,
            dispositivoId
        } = req.body;


        if (!dispositivoId) {

            return res
                .status(400)
                .json({

                    erro:
                        "dispositivoId não informado"

                });

        }


        let valor;

        let titulo;


        if (tipo === "mensal") {

            valor = 3.49;

            titulo =
                "Meu Ponto PRO - Mensal";

        }


        else if (tipo === "anual") {

            valor = 34.99;

            titulo =
                "Meu Ponto PRO - Anual";

        }


        else {

            return res
                .status(400)
                .json({

                    erro:
                        "Plano inválido"

                });

        }


        const resposta =
            await fetch(

                "https://api.mercadopago.com/checkout/preferences",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${ACCESS_TOKEN}`

                    },


                    body:
                        JSON.stringify({

                            items: [

                                {

                                    title:
                                        titulo,

                                    quantity: 1,

                                    currency_id:
                                        "BRL",

                                    unit_price:
                                        valor

                                }

                            ],


                            payment_methods: {

                                excluded_payment_types: []

                            },


                            back_urls: {

                                success:
                                    "https://dvgadigital.github.io/MeuPonto/",

                                failure:
                                    "https://dvgadigital.github.io/MeuPonto/",

                                pending:
                                    "https://dvgadigital.github.io/MeuPonto/"

                            },


                            auto_return:
                                "approved",


                            external_reference:
                                `${dispositivoId}|${tipo}`,


                            notification_url:
                                "https://meu-ponto-api-ajyu.onrender.com/webhook"

                        })

                }

            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            console.log(
                "Erro Mercado Pago:",
                dados
            );


            return res
                .status(resposta.status)
                .json({

                    erro:
                        "Erro ao criar pagamento",

                    detalhes:
                        dados

                });

        }


        res.json({

            sucesso: true,

            id:
                dados.id,

            link:
                dados.init_point

        });


    } catch (erro) {

        console.error(
            "Erro interno:",
            erro
        );


        res
            .status(500)
            .json({

                erro:
                    "Erro interno do servidor"

            });

    }

});


// ===============================
// WEBHOOK MERCADO PAGO
// ===============================

app.post("/webhook", async (req, res) => {

    try {

        console.log(
            "Webhook recebido:",
            req.body
        );


        const tipoNotificacao =
            req.query.type ||
            req.body.type;


        const pagamentoId =
            req.query["data.id"] ||
            (
                req.body.data &&
                req.body.data.id
            );


        if (
            tipoNotificacao !== "payment" ||
            !pagamentoId
        ) {

            return res.sendStatus(200);

        }


        const resposta =
            await fetch(

                `https://api.mercadopago.com/v1/payments/${pagamentoId}`,

                {

                    headers: {

                        "Authorization":
                            `Bearer ${ACCESS_TOKEN}`

                    }

                }

            );


        const pagamento =
            await resposta.json();


        console.log(
            "Detalhes do pagamento:",
            pagamento
        );


        if (
            pagamento.status ===
            "approved"
        ) {


            const referencia =
                pagamento.external_reference ||
                "";


            const [
                dispositivoId,
                tipoPlano
            ] =
                referencia.split("|");


            if (dispositivoId) {

                const agora =
                    new Date();


                const validoAte =
                    new Date(agora);


                if (
                    tipoPlano ===
                    "mensal"
                ) {

                    validoAte.setMonth(
                        validoAte.getMonth() + 1
                    );

                }


                else if (
                    tipoPlano ===
                    "anual"
                ) {

                    validoAte.setFullYear(
                        validoAte.getFullYear() + 1
                    );

                }


                const emailPagador =
                    (
                        pagamento.payer &&
                        pagamento.payer.email
                    ) || null;


                await colecaoPagamentos.updateOne(

                    {
                        dispositivoId:
                            dispositivoId
                    },

                    {

                        $set: {

                            dispositivoId:
                                dispositivoId,

                            plano:
                                tipoPlano,

                            status:
                                "aprovado",

                            pagamentoId:
                                pagamentoId,

                            validoAte:
                                validoAte,

                            emailPagador:
                                emailPagador,

                            atualizadoEm:
                                agora

                        }

                    },

                    {
                        upsert: true
                    }

                );


                console.log(

                    "PRO liberado para:",

                    dispositivoId

                );

            }

        }


        res.sendStatus(200);


    } catch (erro) {

        console.error(
            "Erro no webhook:",
            erro
        );


        res.sendStatus(200);

    }

});


// ===============================
// VERIFICAR PAGAMENTO
// ===============================

app.get(
    "/verificar-pagamento/:dispositivoId",
    async (req, res) => {

        try {

            const {
                dispositivoId
            } = req.params;


            const registro =
                await colecaoPagamentos.findOne({

                    dispositivoId:
                        dispositivoId

                });


            const aprovado =
                !!registro &&
                registro.status ===
                "aprovado";


            const dentroDoPrazo =
                aprovado &&
                registro.validoAte &&
                new Date(
                    registro.validoAte
                ) > new Date();


            const pro =
                aprovado &&
                dentroDoPrazo;


            res.json({

                pro:
                    pro,

                validoAte:
                    registro
                        ? registro.validoAte
                        : null

            });


        } catch (erro) {

            console.error(
                "Erro ao verificar pagamento:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro interno"

                });

        }

    }
);


// ===============================
// INICIAR SERVIDOR
// ===============================

const PORT =
    process.env.PORT || 3000;


async function iniciar() {

    await conectarBanco();


    app.listen(
        PORT,
        () => {

            console.log(
                `Servidor rodando na porta ${PORT}`
            );

        }
    );

}


iniciar();