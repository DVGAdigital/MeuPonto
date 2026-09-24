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


// =========================================================
// BANCO DE DADOS
// =========================================================

async function conectarBanco() {

    try {

        await clienteMongo.connect();

        const banco =
            clienteMongo.db("meuponto");

        colecaoPagamentos =
            banco.collection("pagamentos");

        colecaoDownloads =
            banco.collection("downloads");

        colecaoUsuarios =
            banco.collection("usuarios");


        await colecaoUsuarios.createIndex(
            {
                dispositivoId: 1
            },
            {
                unique: true
            }
        );

        await colecaoDownloads.createIndex({
            data: 1
        });

        await colecaoUsuarios.createIndex({
            primeiraAbertura: 1
        });

        await colecaoUsuarios.createIndex({
            ultimaAbertura: 1
        });

        await colecaoPagamentos.createIndex({
            dispositivoId: 1
        });

        await colecaoPagamentos.createIndex({
            pagamentoId: 1
        });

        await colecaoPagamentos.createIndex({
            emailPagador: 1
        });

        await colecaoPagamentos.createIndex({
            atualizadoEm: 1
        });

        console.log(
            "Conectado ao MongoDB com sucesso!"
        );

    } catch (erro) {

        console.error(
            "ERRO ao conectar no MongoDB:",
            erro.message
        );

    }

}


// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function inicioDoDia() {

    const agora = new Date();

    agora.setHours(
        0,
        0,
        0,
        0
    );

    return agora;

}


function inicioDoMes() {

    const agora = new Date();

    return new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1
    );

}


function formatarData(data) {

    if (!data) {
        return null;
    }

    return new Date(data).toISOString();

}


// =========================================================
// SERVIDOR
// =========================================================

app.get("/", (req, res) => {

    res.send(
        "Meu Ponto - servidor online"
    );

});


// =========================================================
// STATUS
// =========================================================

app.get("/status", async (req, res) => {

    res.json({

        servidor: "online",

        mercadoPago:
            !!ACCESS_TOKEN,

        banco:
            !!colecaoUsuarios,

        data:
            new Date().toISOString()

    });

});


// =========================================================
// VERSÃO DO APP
// =========================================================

app.get("/versao-app", (req, res) => {

    res.json({

        versao: "1.0.1",

        apk:
            "https://github.com/DVGAdigital/MeuPonto/releases/latest/download/MeuPonto.apk"

    });

});


// =========================================================
// DOWNLOAD DO APK
// =========================================================

app.get("/download", async (req, res) => {

    try {

        await colecaoDownloads.insertOne({

            data: new Date(),

            origem:
                req.query.origem ||
                "site"

        });

        console.log(
            "Download registrado"
        );

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


// =========================================================
// REGISTRAR ABERTURA DO APP
// =========================================================

app.post(
    "/registrar-abertura",
    async (req, res) => {

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

    }
);


// =========================================================
// ESTATÍSTICAS
// =========================================================

app.get(
    "/estatisticas",
    async (req, res) => {

        try {

            const hoje =
                inicioDoDia();

            const mes =
                inicioDoMes();


            const totalDownloads =
                await colecaoDownloads.countDocuments();


            const downloadsHoje =
                await colecaoDownloads.countDocuments({

                    data: {
                        $gte: hoje
                    }

                });


            const downloadsMes =
                await colecaoDownloads.countDocuments({

                    data: {
                        $gte: mes
                    }

                });


            const totalUsuarios =
                await colecaoUsuarios.countDocuments();


            const usuariosHoje =
                await colecaoUsuarios.countDocuments({

                    primeiraAbertura: {
                        $gte: hoje
                    }

                });


            const usuariosMes =
                await colecaoUsuarios.countDocuments({

                    primeiraAbertura: {
                        $gte: mes
                    }

                });


            const agora =
                new Date();


            const totalPro =
                await colecaoPagamentos.countDocuments({

                    status: "approved",

                    validoAte: {
                        $gt: agora
                    }

                });


            const pagamentosHoje =
                await colecaoPagamentos.countDocuments({

                    status: "approved",

                    atualizadoEm: {
                        $gte: hoje
                    }

                });


            const pagamentosMes =
                await colecaoPagamentos.countDocuments({

                    status: "approved",

                    atualizadoEm: {
                        $gte: mes
                    }

                });


            const resultadoValor =
                await colecaoPagamentos
                    .aggregate([

                        {
                            $match: {

                                status:
                                    "approved",

                                atualizadoEm: {
                                    $gte: mes
                                }

                            }
                        },

                        {
                            $group: {

                                _id: null,

                                total: {
                                    $sum:
                                        "$valor"
                                }

                            }
                        }

                    ])
                    .toArray();


            const valorRecebido =
                resultadoValor.length
                    ? resultadoValor[0].total
                    : 0;


            const dias = [];


            for (
                let i = 6;
                i >= 0;
                i--
            ) {

                const inicio =
                    new Date();

                inicio.setHours(
                    0,
                    0,
                    0,
                    0
                );

                inicio.setDate(
                    inicio.getDate() - i
                );


                const fim =
                    new Date(inicio);

                fim.setDate(
                    fim.getDate() + 1
                );


                const downloads =
                    await colecaoDownloads
                        .countDocuments({

                            data: {

                                $gte:
                                    inicio,

                                $lt:
                                    fim

                            }

                        });


                const usuarios =
                    await colecaoUsuarios
                        .countDocuments({

                            primeiraAbertura: {

                                $gte:
                                    inicio,

                                $lt:
                                    fim

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


            res.json({

                sucesso: true,

                downloads: {

                    total:
                        totalDownloads,

                    hoje:
                        downloadsHoje,

                    mes:
                        downloadsMes

                },

                usuarios: {

                    total:
                        totalUsuarios,

                    hoje:
                        usuariosHoje,

                    mes:
                        usuariosMes

                },

                pagamentos: {

                    aprovados:
                        await colecaoPagamentos
                            .countDocuments({

                                status:
                                    "approved"

                            }),

                    hoje:
                        pagamentosHoje,

                    mes:
                        pagamentosMes,

                    valorMes:
                        valorRecebido

                },

                pro: {

                    total:
                        totalPro

                },

                dias:
                    dias,

                atualizadoEm:
                    new Date().toISOString()

            });

        } catch (erro) {

            console.error(
                "Erro nas estatísticas:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao carregar estatísticas"

                });

        }

    }
);


// =========================================================
// LISTAR APARELHOS
// =========================================================

app.get(
    "/usuarios",
    async (req, res) => {

        try {

            const limite =
                Math.min(
                    Number(
                        req.query.limite
                    ) || 50,
                    200
                );


            const usuarios =
                await colecaoUsuarios
                    .find({})
                    .sort({
                        ultimaAbertura:
                            -1
                    })
                    .limit(limite)
                    .toArray();


            res.json({

                sucesso: true,

                total:
                    await colecaoUsuarios
                        .countDocuments(),

                usuarios:
                    usuarios.map(
                        usuario => ({

                            dispositivoId:
                                usuario.dispositivoId,

                            primeiraAbertura:
                                formatarData(
                                    usuario.primeiraAbertura
                                ),

                            ultimaAbertura:
                                formatarData(
                                    usuario.ultimaAbertura
                                )

                        })
                    )

            });

        } catch (erro) {

            console.error(
                "Erro ao listar usuários:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao listar usuários"

                });

        }

    }
);


// =========================================================
// CONSULTAR APARELHO ESPECÍFICO
// =========================================================

app.get(
    "/usuarios/:dispositivoId",
    async (req, res) => {

        try {

            const dispositivoId =
                req.params.dispositivoId;


            const usuario =
                await colecaoUsuarios
                    .findOne({

                        dispositivoId:
                            dispositivoId

                    });


            if (!usuario) {

                return res
                    .status(404)
                    .json({

                        encontrado:
                            false,

                        erro:
                            "Aparelho não encontrado"

                    });

            }


            const pagamento =
                await colecaoPagamentos
                    .findOne(

                        {
                            dispositivoId:
                                dispositivoId,

                            status:
                                "approved"

                        },

                        {
                            sort: {
                                atualizadoEm:
                                    -1
                            }
                        }

                    );


            const agora =
                new Date();


            const proAtivo =
                !!pagamento &&
                pagamento.validoAte &&
                new Date(
                    pagamento.validoAte
                ) > agora;


            res.json({

                encontrado: true,

                usuario: {

                    dispositivoId:
                        usuario.dispositivoId,

                    primeiraAbertura:
                        formatarData(
                            usuario.primeiraAbertura
                        ),

                    ultimaAbertura:
                        formatarData(
                            usuario.ultimaAbertura
                        )

                },

                pro: {

                    ativo:
                        !!proAtivo,

                    plano:
                        pagamento
                            ? pagamento.plano
                            : null,

                    validoAte:
                        pagamento
                            ? formatarData(
                                pagamento.validoAte
                            )
                            : null,

                    pagamentoId:
                        pagamento
                            ? pagamento.pagamentoId
                            : null,

                    emailPagador:
                        pagamento
                            ? pagamento.emailPagador
                            : null

                }

            });

        } catch (erro) {

            console.error(
                "Erro ao consultar aparelho:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao consultar aparelho"

                });

        }

    }
);


// =========================================================
// LISTAR PAGAMENTOS
// =========================================================

app.get(
    "/pagamentos",
    async (req, res) => {

        try {

            const limite =
                Math.min(
                    Number(
                        req.query.limite
                    ) || 50,
                    200
                );


            const pagamentos =
                await colecaoPagamentos
                    .find({})
                    .sort({
                        atualizadoEm:
                            -1
                    })
                    .limit(limite)
                    .toArray();


            res.json({

                sucesso: true,

                pagamentos:
                    pagamentos.map(
                        pagamento => ({

                            dispositivoId:
                                pagamento.dispositivoId,

                            pagamentoId:
                                pagamento.pagamentoId,

                            plano:
                                pagamento.plano,

                            status:
                                pagamento.status,

                            valor:
                                pagamento.valor || 0,

                            emailPagador:
                                pagamento.emailPagador ||
                                pagamento.email ||
                                null,

                            nomePagador:
                                pagamento.nomePagador ||
                                null,

                            formaPagamento:
                                pagamento.formaPagamento ||
                                null,

                            tipoPagamento:
                                pagamento.tipoPagamento ||
                                null,

                            validoAte:
                                formatarData(
                                    pagamento.validoAte
                                ),

                            atualizadoEm:
                                formatarData(
                                    pagamento.atualizadoEm
                                )

                        })
                    )

            });

        } catch (erro) {

            console.error(
                "Erro ao listar pagamentos:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao listar pagamentos"

                });

        }

    }
);


// =========================================================
// LISTAR DOWNLOADS
// =========================================================

app.get(
    "/downloads",
    async (req, res) => {

        try {

            const limite =
                Math.min(
                    Number(
                        req.query.limite
                    ) || 100,
                    500
                );


            const downloads =
                await colecaoDownloads
                    .find({})
                    .sort({
                        data:
                            -1
                    })
                    .limit(limite)
                    .toArray();


            res.json({

                sucesso: true,

                total:
                    await colecaoDownloads
                        .countDocuments(),

                downloads:
                    downloads.map(
                        download => ({

                            data:
                                formatarData(
                                    download.data
                                ),

                            origem:
                                download.origem ||
                                "site"

                        })
                    )

            });

        } catch (erro) {

            console.error(
                "Erro ao listar downloads:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao listar downloads"

                });

        }

    }
);


// =========================================================
// CRIAR PAGAMENTO
// =========================================================

app.post(
    "/criar-pagamento",
    async (req, res) => {

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


            if (
                tipo === "mensal"
            ) {

                valor = 3.49;

                titulo =
                    "Meu Ponto PRO - Mensal";

            }

            else if (
                tipo === "anual"
            ) {

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

                        method:
                            "POST",

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

                                        quantity:
                                            1,

                                        currency_id:
                                            "BRL",

                                        unit_price:
                                            valor

                                    }

                                ],

                                payment_methods: {

                                    excluded_payment_types:
                                        []

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
                    .status(
                        resposta.status
                    )
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

    }
);


// =========================================================
// WEBHOOK MERCADO PAGO
// =========================================================

app.post(
    "/webhook",
    async (req, res) => {

        try {

            console.log(
                "========================================"
            );

            console.log(
                "WEBHOOK MERCADO PAGO RECEBIDO"
            );

            console.log(
                "Query:",
                req.query
            );

            console.log(
                "Body:",
                req.body
            );


            const pagamentoId =
                req.query["data.id"] ||
                (
                    req.body.data &&
                    req.body.data.id
                ) ||
                req.body.id;


            const tipoNotificacao =
                req.query.type ||
                req.body.type;


            console.log(
                "Tipo:",
                tipoNotificacao
            );

            console.log(
                "Pagamento ID:",
                pagamentoId
            );


            res.sendStatus(200);


            if (!pagamentoId) {

                console.log(
                    "Webhook sem ID de pagamento."
                );

                return;

            }


            const resposta =
                await fetch(

                    `https://api.mercadopago.com/v1/payments/${pagamentoId}`,

                    {

                        method:
                            "GET",

                        headers: {

                            "Authorization":
                                `Bearer ${ACCESS_TOKEN}`

                        }

                    }

                );


            const pagamento =
                await resposta.json();


            console.log(
                "Resposta Mercado Pago:",
                pagamento
            );


            if (!resposta.ok) {

                console.error(
                    "Erro ao consultar pagamento:",
                    pagamento
                );

                return;

            }


            const referencia =
                pagamento.external_reference ||
                "";


            const partes =
                referencia.split("|");


            const dispositivoId =
                partes[0];


            const tipoPlano =
                partes[1];


            console.log(
                "Dispositivo:",
                dispositivoId
            );

            console.log(
                "Plano:",
                tipoPlano
            );


            if (!dispositivoId) {

                console.error(
                    "Pagamento sem dispositivoId."
                );

                return;

            }


            let validoAte =
                null;


            if (
                pagamento.status ===
                "approved"
            ) {

                validoAte =
                    new Date();


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

            }


            const valor =
                Number(
                    pagamento.transaction_amount
                ) || 0;


            // =================================================
            // DADOS DO PAGADOR
            // =================================================

            const emailPagador =
                pagamento.payer &&
                pagamento.payer.email
                    ? pagamento.payer.email
                    : null;


            const nomePagador = [
                pagamento.payer &&
                    pagamento.payer.first_name,
                pagamento.payer &&
                    pagamento.payer.last_name
            ]
                .filter(Boolean)
                .join(" ") || null;


            const formaPagamento =
                pagamento.payment_method_id ||
                null;


            const tipoPagamento =
                pagamento.payment_type_id ||
                null;


            // =================================================
            // SALVAR PAGAMENTO
            // =================================================

            const agora =
                new Date();


            await colecaoPagamentos.updateOne(

                {

                    pagamentoId:
                        String(
                            pagamento.id
                        )

                },

                {

                    $set: {

                        dispositivoId:
                            dispositivoId,

                        pagamentoId:
                            String(
                                pagamento.id
                            ),

                        plano:
                            tipoPlano,

                        status:
                            pagamento.status,

                        valor:
                            valor,

                        validoAte:
                            validoAte,

                        emailPagador:
                            emailPagador,

                        nomePagador:
                            nomePagador,

                        formaPagamento:
                            formaPagamento,

                        tipoPagamento:
                            tipoPagamento,

                        atualizadoEm:
                            agora

                    }

                },

                {

                    upsert:
                        true

                }

            );


            console.log(
                "========================================"
            );

            console.log(
                "PAGAMENTO REGISTRADO COM SUCESSO"
            );

            console.log(
                "ID:",
                pagamento.id
            );

            console.log(
                "Status:",
                pagamento.status
            );

            console.log(
                "Valor:",
                valor
            );

            console.log(
                "Plano:",
                tipoPlano
            );

            console.log(
                "Dispositivo:",
                dispositivoId
            );

            console.log(
                "E-mail:",
                emailPagador
            );

            console.log(
                "Nome:",
                nomePagador
            );

            console.log(
                "Forma:",
                formaPagamento
            );

            console.log(
                "Tipo:",
                tipoPagamento
            );

            console.log(
                "========================================"
            );


        } catch (erro) {

            console.error(
                "ERRO NO WEBHOOK:",
                erro
            );

        }

    }
);


// =========================================================
// VERIFICAR PAGAMENTO / PRO
// =========================================================

app.get(
    "/verificar-pagamento/:dispositivoId",
    async (req, res) => {

        try {

            const {
                dispositivoId
            } = req.params;


            const registro =
                await colecaoPagamentos
                    .findOne(

                        {

                            dispositivoId:
                                dispositivoId,

                            status:
                                "approved"

                        },

                        {

                            sort: {

                                atualizadoEm:
                                    -1

                            }

                        }

                    );


            const agora =
                new Date();


            const pro =
                !!registro &&
                !!registro.validoAte &&
                new Date(
                    registro.validoAte
                ) > agora;


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


// =========================================================
// INICIAR SERVIDOR
// =========================================================

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