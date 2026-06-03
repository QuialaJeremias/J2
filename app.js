const express = require('express');
const fileupload = require('express-fileupload');
const mysql = require('mysql2');
const { engine } = require('express-handlebars');
const path = require('path');
const admin = require('firebase-admin'); 
const session = require('express-session');

const app = express();

// --- CONFIGURAÇÕES E MIDDLEWARES (Intermediários) ---
app.use(fileupload()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 

// Arquivos Estáticos
app.use('/bootstrap', express.static('./node_modules/bootstrap/dist')); 
app.use('/css', express.static('./css')); 
app.use('/img', express.static('./img')); 
app.use(express.static('public')); 

app.use(session({
    secret: 'seu_segredo_super_seguro_luanda', 
    resave: false,
    saveUninitialized: true
}));

// Configuração do Handlebars
app.engine('handlebars', engine()); 
app.set('view engine', 'handlebars'); 
app.set('views', './views'); 

// --- CONEXÃO BANCO DE DADOS ---

// MySQL Local
const conexao = mysql.createConnection({
    host: 'localhost',

/*
    app.js
    ------
    Servidor Node/Express responsável por:
      - servir conteúdo estático em /public
      - conectar ao MySQL local e ao Firestore
      - expor rotas de sincronização e autenticação
      - processar formulários de cadastro e resultados
    A autenticação administradora ainda é feita por contraste via coleção
    `Administradores` no Firestore e, em algumas rotas, via tabela MySQL.
*/
    user: 'root',
    password: '',
    database: 'j_direcionamentos'
});

conexao.connect(function(erro) {
    if (erro) throw erro;
    console.log('✅ Conectado ao banco j_direcionamentos (MySQL)');
});

// Inicializar o Firebase
const serviceAccount = require("./firebase-credenciais.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();
console.log('✅ Conectado ao Firebase Cloud com sucesso!');


// --- ROTAS DE NAVEGAÇÃO ---

// ROTA DE SINCRONIZAÇÃO HÍBRIDA
app.get('/institutos', async (req, res) => {
    try {
        const snapshot = await firestore.collection('Institutos').get();
        const listaInstitutos = [];

        snapshot.forEach(doc => {
            listaInstitutos.push({ id_firebase: doc.id, ...doc.data() });
        });

        listaInstitutos.forEach(inst => {
            const querySQL = `
                INSERT INTO institutos (nome, mun, img, cursos, site) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE mun=?, img=?, cursos=?, site=?`;
            
            const valores = [
                inst.nome, inst.mun, inst.img, inst.cursos, inst.site,
                inst.mun, inst.img, inst.cursos, inst.site            
            ];

            conexao.query(querySQL, valores, (err) => {
                if (err) console.error("Erro ao espelhar instituto no MySQL:", err);
            });
        });

        res.render('institutos', { 
            institutos: listaInstitutos 
        });
// Rota principal de teste / dashboard de institutos
// Esta rota busca os institutos no Firebase e os espelha no MySQL local.

    } catch (error) {
        console.error("Erro no processo de sincronização:", error);

        conexao.query('SELECT * FROM institutos', (erroMysql, resultado) => {
            if (erroMysql) {
                return res.status(500).json({ error: "Falha ao carregar os dados locais." });
            }
            res.render('institutos', { institutos: resultado });
        });
    }
});


// --- VALIDAÇÃO DO ADMIN DIRETA NO BANCO ---
app.get('/admin/autenticar', (req, res) => {
    const senhaDigitada = req.query.senha;

    const sql = "SELECT * FROM usuario WHERE tipo = 'admin' AND senha = ? LIMIT 1";
    
    conexao.query(sql, [senhaDigitada], (erro, resultados) => {
        if (erro) {
            console.error("Erro no banco:", erro);
            return res.status(500).send("Erro interno do servidor.");
        }

        if (resultados.length > 0) {
            console.log(`💼 Acesso Autorizado para o Admin!`);
            return res.sendFile(path.join(__dirname, 'admin2.html')); 
        } else {
            return res.send(`
                <script>
                    alert("Password de Administrador inválida!");
                    window.location.href = "http://localhost:8080/";
                </script>
            `);
        }
    });
});


// --- OPERAÇÕES DE BANCO (POST) ---

// Cadastrar novo instituto (Painel Admin)
app.post('/cadastrar', function(req, res) {
    let { nome, mun, categoria, Descrico } = req.body; 
    let img = req.files.img.name; 

    let sql = `INSERT INTO institutos (nome, mun, img, Descrico, categoria) VALUES (?, ?, ?, ?, ?)`;

    conexao.query(sql, [nome, mun, img, Descrico, categoria], function(erro) {
        if (erro) {
            console.log(erro);
            return res.status(500).send("Erro ao cadastrar");
        }
        
        req.files.img.mv(path.join(__dirname, '/img/', img));
        res.redirect('/institutos');
    });
});

// Cadastrar um curso associado a um Instituto (Painel Admin)
app.post('/cadastrar-curso', (req, res) => {
    const { nome_curso, duracao, vagas, instituto_id } = req.body;

    const sql = "INSERT INTO curso (nome_curso, duracao, vagas, instituto_id) VALUES (?, ?, ?, ?)";
    
    conexao.query(sql, [nome_curso, duracao || '4 anos', vagas || 0, instituto_id], (erro) => {
        if (erro) {
            console.error("⚠️ Erro ao cadastrar curso:", erro);
            return res.status(500).send("Erro ao cadastrar o curso.");
        }
        console.log(`📚 Curso [${nome_curso}] adicionado ao Instituto ID: ${instituto_id}`);
        res.redirect('/institutos');
    });
});

// Processamento do Resultado do Teste Vocacional
app.post('/resultado', (req, res) => {
    let nome = req.body.nome || "Estudante Anónimo"; 
    
    let tech = parseInt(req.body.tecnologia) || 0;
    let saude = parseInt(req.body.saude) || 0;
    let industrial = parseInt(req.body.industrial) || 0; 
    let eletro = parseInt(req.body.eletro) || 0;

    let categoriaVencedora = "tech";
    let maiorPontuacao = tech;

    if (saude > maiorPontuacao) { categoriaVencedora = "saude"; maiorPontuacao = saude; }
    if (industrial > maiorPontuacao) { categoriaVencedora = "industrial"; maiorPontuacao = industrial; }
    if (eletro > maiorPontuacao) { categoriaVencedora = "eletro"; maiorPontuacao = eletro; }

    const sqlSalvarHistorico = "INSERT INTO recomendacao (nome_estudante, categoria_sugerida) VALUES (?, ?)";
    
    conexao.query(sqlSalvarHistorico, [nome, categoriaVencedora], (erroSalvar) => {
        if (erroSalvar) {
            console.error("⚠️ Erro ao salvar histórico de recomendação:", erroSalvar);
        } else {
            console.log(`✅ Recomendação (${categoriaVencedora}) guardada com sucesso para ${nome}!`);
        }

        let sqlInstitutos = "SELECT * FROM institutos WHERE categoria = ?";
        conexao.query(sqlInstitutos, [categoriaVencedora], (erroBusca, retorno) => {
            if (erroBusca) throw erroBusca;

            res.render('resultados', {
                nome: nome,
                categoria: categoriaVencedora,
                institutos: retorno
            });
        });
    });
});

// Rota de Login para o estudante
app.post('/usuario/login', (req, res) => {
    const { email, senha } = req.body;

    const sql = "SELECT * FROM usuario WHERE email = ? AND senha = ? AND tipo = 'estudante' LIMIT 1";
    
    conexao.query(sql, [email, senha], (erro, resultados) => {
        if (erro) return res.status(500).send("Erro interno");

        if (resultados.length > 0) {
            req.session.usuarioLogadoId = resultados[0].id;
            req.session.usuarioLogadoNome = resultados[0].email; 

            console.log(`🔑 Estudante [${email}] fez login com o ID: ${resultados[0].id}`);
            res.redirect('/'); 
        } else {
            res.send("<script>alert('Dados inválidos'); window.location.href='/login';</script>");
        }
    });
});

// Identificar se é Estudante Registado ou Visitante Compilado (Apenas UMA versão limpa)
app.post('/identificar-estudante', (req, res) => {
    const { nome, telefone, escola_origem } = req.body; // Ajustado para corresponder ao banco
    
    let usuarioId = req.session.usuarioLogadoId || null; 

    const sql = "INSERT INTO estudantes (nome, telefone, escola_origem, usuario_id) VALUES (?, ?, ?, ?)";
    const nomeFinal = nome || (req.session.usuarioLogadoNome ? "Estudante Registado" : "Visitante Anónimo");

    conexao.query(sql, [nomeFinal, telefone || null, escola_origem || null, usuarioId], (erro, resultado) => {
        if (erro) {
            console.error("Erro ao registar estudante:", erro);
            return res.status(500).send("Erro no servidor");
        }

        const idEstudanteCriado = resultado.insertId;
        console.log(`👤 Perfil Compilado! ID Estudante: ${idEstudanteCriado} | Vinculado ao Usuário ID: ${usuarioId}`);
        
        res.redirect(`/teste?estudante=${idEstudanteCriado}`);
    });
});

// Rota para listar todos os estudantes registados
app.get('/estudantes', (req, res) => {
    conexao.query('SELECT * FROM estudantes', (erro, resultados) => {
        if (erro) {
            console.error("Erro ao buscar estudantes:", erro);
            return res.status(500).send("Erro ao carregar dados.");
        }
        // Renderiza uma view chamada 'estudantes' que terás de criar
        res.render('estudantes', { estudantes: resultados });
    });
});

// Rota para Estudanetes
app.get('/lista-estudantes', (req, res) => {
    conexao.query('SELECT * FROM estudantes', (err, result) => {
        res.render('estudantes', { estudantes: result });
    });
});

// Rota para Cursos
app.get('/lista-cursos', (req, res) => {
    conexao.query('SELECT * FROM curso', (err, result) => {
        res.render('cursos', { cursos: result });
    });
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Servidor a rodar em http://localhost:${PORT}`);
});