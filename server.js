const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());


async function enviarEmail(destinatario, assunto, mensagem) {
    const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: "D'VGA <suporte@dvga.com.br>",
            to: [destinatario],
            subject: assunto,
            text: mensagem
        })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
        console.error("Erro ao enviar e-mail:", resultado);
        throw new Error("Não foi possível enviar o e-mail.");
    }

    return resultado;
}



const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

let colecaoPagamentos;
let colecaoDownloads;
let colecaoUsuarios;
let colecaoRecuperacoesPro;
let colecaoEmailsVerificados;

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

        colecaoRecuperacoesPro = banco.collection("recuperacoesPro");
        colecaoEmailsVerificados = banco.collection("emailsVerificados");


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
            "https://play.google.com/store/apps/details?id=com.dvga.app.meuponto"

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

            const emailVerificado = await colecaoEmailsVerificados.findOne({
                dispositivoId: dispositivoId,
                verificado: true
            });

            if (!emailVerificado) {
                return res.status(400).json({
                    erro: "Confirme seu e-mail antes de assinar o Meu Ponto PRO."
                });
            }

            let valor;
            let titulo;


            
if (
    tipo === "mensal"
) {

    valor = 4.99;

    titulo =
        "Meu Ponto PRO - Mensal";

}

else if (
    tipo === "anual"
) {

    valor = 49.99;

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
    "E-MAIL RECEBIDO DO MERCADO PAGO:",
    pagamento.payer?.email
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

           const emailRegistrado = await colecaoEmailsVerificados.findOne({
    dispositivoId: dispositivoId,
    verificado: true
});

const emailPagador = emailRegistrado
    ? emailRegistrado.email
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





// =========================================================
// VERIFICAR SE UM E-MAIL POSSUI PLANO PRO ATIVO
// =========================================================
app.post("/consultar-plano-email", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ erro: "Informe um e-mail válido." });
        }
        const agora = new Date();
        const pagamento = await colecaoPagamentos.find({
            $or: [
                { emailPagador: { $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } },
                { email: { $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } }
            ],
            status: "approved",
            validoAte: { $gt: agora }
        }).sort({ atualizadoEm: -1 }).limit(1).next();
        return res.json({ planoAtivo: Boolean(pagamento), validoAte: pagamento ? pagamento.validoAte : null });
    } catch (erro) {
        console.error("Erro ao verificar plano por e-mail:", erro);
        return res.status(500).json({ erro: "Não foi possível verificar o plano agora." });
    }
});


// =========================================================
// SOLICITAR VERIFICAÇÃO DE E-MAIL PARA O PRO
// =========================================================

app.post("/solicitar-verificacao-email", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const dispositivoId = String(req.body.dispositivoId || "").trim();

        if (
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !dispositivoId
        ) {
            return res.status(400).json({
                erro: "Informe um e-mail válido."
            });
        }

        const codigo = crypto.randomInt(100000, 1000000).toString();
        const codigoHash = crypto
            .createHash("sha256")
            .update(codigo)
            .digest("hex");

        const agora = new Date();

        await colecaoRecuperacoesPro.deleteMany({
            email: email,
            finalidade: "verificar-email"
        });

        await colecaoRecuperacoesPro.insertOne({
            email: email,
            dispositivoId: dispositivoId,
            finalidade: "verificar-email",
            codigoHash: codigoHash,
            criadoEm: agora,
            expiraEm: new Date(agora.getTime() + 10 * 60 * 1000),
            tentativas: 0,
            usado: false
        });

        await enviarEmail(
            email,
            "Código para confirmar seu e-mail - Meu Ponto",
            `Seu código de confirmação é: ${codigo}\n\nEle expira em 10 minutos. Se você não solicitou esse código, ignore este e-mail.`
        );

        return res.json({
            sucesso: true,
            mensagem: "Código enviado para seu e-mail."
        });

    } catch (erro) {
        console.error("Erro ao solicitar verificação de e-mail:", erro);

        return res.status(500).json({
            erro: "Não foi possível enviar o código. Tente novamente."
        });
    }
});




// =========================================================
// CONFIRMAR E-MAIL PARA O PRO
// =========================================================

app.post("/confirmar-verificacao-email", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const codigo = String(req.body.codigo || "").trim();
        const dispositivoId = String(req.body.dispositivoId || "").trim();

        if (
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^\d{6}$/.test(codigo) ||
            !dispositivoId
        ) {
            return res.status(400).json({
                erro: "Informe o e-mail, o código de 6 dígitos e o dispositivo."
            });
        }

        const agora = new Date();

        const registro = await colecaoRecuperacoesPro.findOne({
            email: email,
            dispositivoId: dispositivoId,
            finalidade: "verificar-email",
            usado: false,
            expiraEm: { $gt: agora }
        });

        if (!registro) {
            return res.status(400).json({
                erro: "Código inválido ou expirado. Solicite outro."
            });
        }

        if (registro.tentativas >= 5) {
            await colecaoRecuperacoesPro.deleteOne({
                _id: registro._id
            });

            return res.status(400).json({
                erro: "Limite de tentativas atingido. Solicite outro código."
            });
        }

        const codigoHash = crypto
            .createHash("sha256")
            .update(codigo)
            .digest("hex");

        if (codigoHash !== registro.codigoHash) {
            await colecaoRecuperacoesPro.updateOne(
                { _id: registro._id },
                { $inc: { tentativas: 1 } }
            );

            return res.status(400).json({
                erro: "Código incorreto."
            });
        }

        const consumo = await colecaoRecuperacoesPro.updateOne(
            {
                _id: registro._id,
                usado: false,
                expiraEm: { $gt: agora },
                tentativas: { $lt: 5 }
            },
            {
                $set: {
                    usado: true,
                    usadoEm: agora
                }
            }
        );

        if (consumo.modifiedCount !== 1) {
            return res.status(400).json({
                erro: "Código já utilizado ou expirado."
            });
        }

        await colecaoEmailsVerificados.updateOne(
            { dispositivoId: dispositivoId },
            {
                $set: {
                    email: email,
                    verificado: true,
                    verificadoEm: agora
                }
            },
            { upsert: true }
        );

        return res.json({
            sucesso: true,
            mensagem: "E-mail confirmado e registrado."
        });

    } catch (erro) {
        console.error("Erro ao confirmar e-mail:", erro);

        return res.status(500).json({
            erro: "Não foi possível confirmar o e-mail."
        });
    }
});






/* =========================================================
   CONFIRMAR RECUPERAÇÃO DO PRO
   ========================================================= */

app.post("/confirmar-recuperacao-pro", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const codigo = String(req.body.codigo || "").trim();
        const dispositivoId = String(req.body.dispositivoId || "").trim();

        if (
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^\d{6}$/.test(codigo) ||
            !dispositivoId
        ) {
            return res.status(400).json({
                erro: "Informe o e-mail, o código de 6 dígitos e o dispositivo."
            });
        }

        const agora = new Date();

        const recuperacao = await colecaoRecuperacoesPro.findOne({
            email: email,
            finalidade: "recuperar-pro",
            usado: false,
            expiraEm: { $gt: agora }
        });

        if (!recuperacao) {
            return res.status(400).json({
                erro: "Código inválido ou expirado. Solicite outro."
            });
        }

        if (recuperacao.tentativas >= 5) {
            await colecaoRecuperacoesPro.deleteOne({
                _id: recuperacao._id
            });

            return res.status(400).json({
                erro: "Limite de tentativas atingido. Solicite outro código."
            });
        }

        const codigoHash = crypto
            .createHash("sha256")
            .update(codigo)
            .digest("hex");

        if (codigoHash !== recuperacao.codigoHash) {
            await colecaoRecuperacoesPro.updateOne(
                { _id: recuperacao._id },
                { $inc: { tentativas: 1 } }
            );

            return res.status(400).json({
                erro: "Código incorreto."
            });
        }

        const pagamento = await colecaoPagamentos.find({
    $or: [
        { emailPagador: { $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } },
        { email: { $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } }
    ],
    status: "approved",
    validoAte: { $gt: agora }
}).sort({ atualizadoEm: -1 }).limit(1).next();

        if (!pagamento) {
            await colecaoRecuperacoesPro.deleteOne({
                _id: recuperacao._id
            });

            return res.status(400).json({
                erro: "Não encontramos um plano PRO ativo para esse e-mail."
            });
        }

        const consumoCodigo = await colecaoRecuperacoesPro.updateOne(
            {
                _id: recuperacao._id,
                usado: false,
                expiraEm: { $gt: agora },
                tentativas: { $lt: 5 }
            },
            {
                $set: {
                    usado: true,
                    usadoEm: agora
                }
            }
        );

        if (consumoCodigo.modifiedCount !== 1) {
            return res.status(400).json({
                erro: "Esse código já foi utilizado ou expirou."
            });
        }

        await colecaoPagamentos.updateOne(
            { pagamentoId: pagamento.pagamentoId },
            {
                $set: {
                    dispositivoId: dispositivoId,
                    atualizadoEm: agora
                }
            }
        );


await colecaoEmailsVerificados.updateOne(
    { dispositivoId: dispositivoId },
    {
        $set: {
            email: email,
            verificado: true,
            verificadoEm: agora
        }
    },
    { upsert: true }
);


      
        return res.json({
            sucesso: true,
            pro: true,
            validoAte: pagamento.validoAte
        });

    } catch (erro) {
        console.error("Erro ao confirmar recuperação do PRO:", erro);

        return res.status(500).json({
            erro: "Não foi possível confirmar a recuperação. Tente novamente."
        });
    }
});



/* =========================================================
   SOLICITAR RECUPERAÇÃO DO PRO
   ========================================================= */

app.post("/solicitar-recuperacao-pro", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                erro: "Informe um e-mail válido."
            });
        }

        const agora = new Date();

        const pagamento = await colecaoPagamentos.find({
    $or: [
        {
            emailPagador: {
                $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                $options: "i"
            }
        },
        {
            email: {
                $regex: "^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                $options: "i"
            }
        }
    ],
    status: "approved",
    validoAte: { $gt: agora }
}).sort({ atualizadoEm: -1 }).limit(1).next();

        if (!pagamento) {
            return res.status(404).json({
                erro: "Não encontramos um plano PRO ativo para esse e-mail."
            });
        }

        const codigo = crypto.randomInt(100000, 1000000).toString();
        const codigoHash = crypto
            .createHash("sha256")
            .update(codigo)
            .digest("hex");

await colecaoRecuperacoesPro.deleteMany({
            email: email,
            finalidade: "recuperar-pro"
        });

        await colecaoRecuperacoesPro.insertOne({
            email: email,
            finalidade: "recuperar-pro",
            codigoHash: codigoHash,
            pagamentoId: pagamento.pagamentoId,
            criadoEm: agora,
            expiraEm: new Date(agora.getTime() + 10 * 60 * 1000),
            tentativas: 0,
            usado: false
        });

        await enviarEmail(
            email,
            "Código para recuperar seu Meu Ponto PRO",
            `Seu código de recuperação é: ${codigo}\n\nEle expira em 10 minutos. Se você não solicitou essa recuperação, ignore este e-mail.`
        );

        return res.json({
            sucesso: true,
            mensagem: "Código enviado para o e-mail da compra."
        });

    } catch (erro) {
        console.error("Erro ao solicitar recuperação do PRO:", erro);

        return res.status(500).json({
            erro: "Não foi possível enviar o código agora. Tente novamente."
        });
    }
});





// =========================================================
// PAGAMENTOS DENTRO DO APP (PIX E CARTÃO)
//
// Cole este bloco no server.js, logo ANTES da linha:
//     const PORT = process.env.PORT || 3000;
//
// Também faça isto no Render (Environment):
//     MERCADOPAGO_PUBLIC_KEY = a Public Key de PRODUÇÃO (começa com APP_USR-)
//
// Não precisa instalar nada novo.
// =========================================================

const PLANOS_PRO = {
    mensal: { valor: 4.99, titulo: "Meu Ponto PRO - Mensal" },
    anual: { valor: 49.99, titulo: "Meu Ponto PRO - Anual" }
};

const PIX_VALIDADE_MINUTOS = 30;

const URL_WEBHOOK = "https://meu-ponto-api-ajyu.onrender.com/webhook";

const MENSAGENS_CARTAO = {
    cc_rejected_insufficient_amount: "Saldo ou limite insuficiente. Tente outro cartão ou use o Pix.",
    cc_rejected_bad_filled_card_number: "Número do cartão incorreto. Confira e tente de novo.",
    cc_rejected_bad_filled_date: "Data de validade incorreta. Confira e tente de novo.",
    cc_rejected_bad_filled_security_code: "Código de segurança incorreto. Confira e tente de novo.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão e tente de novo.",
    cc_rejected_call_for_authorize: "Seu banco pediu autorização. Fale com o banco ou use o Pix.",
    cc_rejected_card_disabled: "Cartão desativado. Fale com o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Você já fez um pagamento igual a esse. Aguarde a confirmação.",
    cc_rejected_high_risk: "Pagamento recusado por segurança. Use o Pix ou outro cartão.",
    cc_rejected_max_attempts: "Muitas tentativas. Use outro cartão ou o Pix."
};

const MENSAGEM_CARTAO_PADRAO = "Pagamento recusado. Tente outro cartão ou use o Pix.";


// O Mercado Pago pede a validade do Pix com o fuso do Brasil (-03:00).
function dataExpiracaoMercadoPago(minutos) {
    const brasilia = new Date(
        Date.now() + minutos * 60 * 1000 - 3 * 60 * 60 * 1000
    );

    return brasilia.toISOString().replace("Z", "-03:00");
}


async function emailVerificadoDoAparelho(dispositivoId) {
    const registro = await colecaoEmailsVerificados.findOne({
        dispositivoId: dispositivoId,
        verificado: true
    });

    return registro && registro.email ? registro.email : null;
}


// Grava o pagamento aprovado e libera o PRO. Se o webhook já gravou, não faz nada.
async function registrarPagamentoAprovado(pagamento, dispositivoId, tipoPlano) {
    const jaRegistrado = await colecaoPagamentos.findOne({
        pagamentoId: String(pagamento.id),
        status: "approved"
    });

    if (jaRegistrado) return;

    const agora = new Date();
    const validoAte = new Date(agora);

    if (tipoPlano === "anual") {
        validoAte.setFullYear(validoAte.getFullYear() + 1);
    } else {
        validoAte.setMonth(validoAte.getMonth() + 1);
    }

    await colecaoPagamentos.updateOne(
        { pagamentoId: String(pagamento.id) },
        {
            $set: {
                dispositivoId: dispositivoId,
                pagamentoId: String(pagamento.id),
                plano: tipoPlano,
                status: "approved",
                valor: Number(pagamento.transaction_amount) || 0,
                validoAte: validoAte,
                emailPagador: await emailVerificadoDoAparelho(dispositivoId),
                nomePagador: null,
                formaPagamento: pagamento.payment_method_id || null,
                tipoPagamento: pagamento.payment_type_id || null,
                atualizadoEm: agora
            }
        },
        { upsert: true }
    );
}


// ---------------------------------------------------------
// CONFIGURAÇÃO PÚBLICA (Public Key e valores dos planos)
// ---------------------------------------------------------

app.get("/config-pagamento", (req, res) => {
    res.json({
        publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || null,
        planos: {
            mensal: PLANOS_PRO.mensal.valor,
            anual: PLANOS_PRO.anual.valor
        }
    });
});


// ---------------------------------------------------------
// CRIAR PIX
// ---------------------------------------------------------

app.post("/criar-pix", async (req, res) => {
    try {
        const tipo = String(req.body.tipo || "");
        const dispositivoId = String(req.body.dispositivoId || "").trim();
        const plano = PLANOS_PRO[tipo];

        if (!dispositivoId) {
            return res.status(400).json({ erro: "dispositivoId não informado" });
        }

        if (!plano) {
            return res.status(400).json({ erro: "Plano inválido" });
        }

        const email = await emailVerificadoDoAparelho(dispositivoId);

        if (!email) {
            return res.status(400).json({
                erro: "Confirme seu e-mail antes de assinar o Meu Ponto PRO."
            });
        }

        const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "X-Idempotency-Key": crypto.randomUUID()
            },
            body: JSON.stringify({
                transaction_amount: plano.valor,
                description: plano.titulo,
                payment_method_id: "pix",
                payer: { email: email },
                external_reference: `${dispositivoId}|${tipo}`,
                notification_url: URL_WEBHOOK,
                date_of_expiration: dataExpiracaoMercadoPago(PIX_VALIDADE_MINUTOS)
            })
        });

        const dados = await resposta.json();

        const pix =
            dados.point_of_interaction &&
            dados.point_of_interaction.transaction_data;

        if (!resposta.ok || !pix || !pix.qr_code) {
            console.error("Erro ao criar Pix:", resposta.status, dados);

            return res.status(502).json({
                erro: "Não foi possível gerar o Pix agora. Tente novamente."
            });
        }

        return res.json({
            sucesso: true,
            pagamentoId: String(dados.id),
            qrCode: pix.qr_code,
            qrCodeBase64: pix.qr_code_base64,
            valor: plano.valor
        });

    } catch (erro) {
        console.error("Erro interno ao criar Pix:", erro);

        return res.status(500).json({ erro: "Erro interno do servidor" });
    }
});


// ---------------------------------------------------------
// PAGAR COM CARTÃO
// O app manda só o token do cartão (o número nunca passa por aqui).
// O valor vem sempre do servidor, nunca do app.
// ---------------------------------------------------------

app.post("/pagar-cartao", async (req, res) => {
    try {
        const tipo = String(req.body.tipo || "");
        const dispositivoId = String(req.body.dispositivoId || "").trim();
        const formData = req.body.formData || {};
        const plano = PLANOS_PRO[tipo];

        if (!dispositivoId) {
            return res.status(400).json({ erro: "dispositivoId não informado" });
        }

        if (!plano) {
            return res.status(400).json({ erro: "Plano inválido" });
        }

        if (!formData.token || !formData.payment_method_id) {
            return res.status(400).json({ erro: "Dados do cartão incompletos." });
        }

        const email = await emailVerificadoDoAparelho(dispositivoId);

        if (!email) {
            return res.status(400).json({
                erro: "Confirme seu e-mail antes de assinar o Meu Ponto PRO."
            });
        }

        const corpo = {
            transaction_amount: plano.valor,
            token: formData.token,
            description: plano.titulo,
            installments: 1,
            payment_method_id: formData.payment_method_id,
            payer: {
                email: email,
                identification: formData.payer && formData.payer.identification
            },
            external_reference: `${dispositivoId}|${tipo}`,
            notification_url: URL_WEBHOOK
        };

        if (formData.issuer_id) {
            corpo.issuer_id = formData.issuer_id;
        }

        const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "X-Idempotency-Key": crypto.randomUUID()
            },
            body: JSON.stringify(corpo)
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            console.error(
                "Erro ao cobrar cartão:",
                resposta.status,
                dados.message || dados.error || "",
                dados.cause ? JSON.stringify(dados.cause) : ""
            );

            return res.status(502).json({
                erro: "Não foi possível processar o cartão agora. Tente novamente ou use o Pix."
            });
        }

        if (dados.status === "approved") {
            await registrarPagamentoAprovado(dados, dispositivoId, tipo);
        }

        return res.json({
            status: dados.status,
            pagamentoId: String(dados.id),
            mensagem: dados.status === "rejected"
                ? (MENSAGENS_CARTAO[dados.status_detail] || MENSAGEM_CARTAO_PADRAO)
                : null
        });

    } catch (erro) {
        console.error("Erro interno ao pagar com cartão:", erro);

        return res.status(500).json({ erro: "Erro interno do servidor" });
    }
});


// ---------------------------------------------------------
// STATUS DE UM PAGAMENTO (Pix ou cartão em análise)
// O app consulta a cada poucos segundos. Se já foi aprovado e o
// webhook ainda não gravou, grava aqui também.
// ---------------------------------------------------------

app.get("/status-pagamento/:pagamentoId", async (req, res) => {
    try {
        const pagamentoId = String(req.params.pagamentoId || "").replace(/\D/g, "");
        const dispositivoId = String(req.query.dispositivoId || "").trim();

        if (!pagamentoId || !dispositivoId) {
            return res.status(400).json({ erro: "Dados incompletos" });
        }

        const resposta = await fetch(
            `https://api.mercadopago.com/v1/payments/${pagamentoId}`,
            { headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` } }
        );

        const pagamento = await resposta.json();

        if (!resposta.ok) {
            return res.status(404).json({ erro: "Pagamento não encontrado" });
        }

        const partes = String(pagamento.external_reference || "").split("|");

        // só o aparelho que criou o pagamento pode consultá-lo
        if (partes[0] !== dispositivoId) {
            return res.status(403).json({ erro: "Pagamento de outro aparelho" });
        }

        if (pagamento.status === "approved") {
            await registrarPagamentoAprovado(pagamento, dispositivoId, partes[1]);
        }

        return res.json({ status: pagamento.status });

    } catch (erro) {
        console.error("Erro ao consultar pagamento:", erro);

        return res.status(500).json({ erro: "Erro interno" });
    }
});






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