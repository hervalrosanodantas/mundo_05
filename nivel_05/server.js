const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { Sequelize, DataTypes, Op } = require("sequelize");

const app = express();
const port = process.env.PORT || 3000;
const secretKey = "supersecretkey";

app.use(bodyParser.json());

// Setando o Sequelize com SQLite
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite",
});

// Criando modelo de usuário
const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  perfil: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

// Criando modelo de empresa
const Company = sequelize.define("Company", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

// Criando modelo de contrato
const Contract = sequelize.define("Contract", {
  data_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

// Vinculando Contrato e Empresa
Company.hasMany(Contract);
Contract.belongsTo(Company);

// Sincronização e inicialização dos modelos com o banco de dados
async function initialize() {
  await sequelize.sync();

  try {
    // Populando alguns dados
    const adminUser = await User.create({
      username: "hervaldantas",
      password: "123456789",
      perfil: "admin",
      email: "admin@SoftwareHouse.com",
    });
    const regularUser = await User.create({
      username: "antoniodantas",
      password: "123456",
      perfil: "user",
      email: "user@SoftwareHouse.com",
    });
    const colabUser = await User.create({
      username: "renatodantas",
      password: "123",
      perfil: "admin",
      email: "colab@SoftwareHouse.com",
    });

    // Algumas empresas de exemplo
    const dantascorp = await Company.create({ name: "Dantas Corporation" });
    const ronamite = await Company.create({ name: "Ronan Mineradora" });
    const tecnologiacorp = await Company.create({
      name: "Tecnologia Corporation",
    });

    // Alguns contratos de exemplo linkados às empresas
    await Contract.create({
      data_inicio: "2024-09-13",
      CompanyId: dantascorp.id,
    });
    await Contract.create({
      data_inicio: "2024-09-14",
      CompanyId: ronamite.id,
    });
    await Contract.create({
      data_inicio: "2024-09-15",
      CompanyId: tecnologiacorp.id,
    });

    console.log("Dados inicializados com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar dados:", error);
  }
}

initialize();

// Função para verificar o token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null)
    return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// Endpoint para login do usuário
app.post("/api/auth/login", async (req, res) => {
  const credentials = req.body;
  console.log("Received login request with credentials:", credentials); // Verifique os dados recebidos

  // Verifica se o objeto credentials e os campos necessários estão presentes
  if (!credentials || !credentials.username || !credentials.password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    let user = await User.findOne({
      where: { username: credentials.username },
    });

    if (user && user.password === credentials.password) {
      // Gera o token JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, perfil: user.perfil },
        secretKey,
        { expiresIn: "1h" }
      );
      res.json({ token });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint de recuperação dos dados do usuário logado
app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ data: req.user });
});

// Endpoint de recuperação de todos os usuários (apenas para admin)
app.get("/api/users", authenticateToken, async (req, res) => {
  if (req.user.perfil !== "admin") {
    return res
      .status(403)
      .json({ message: "Somente o Administrador tem acesso" });
  }
  let users = await User.findAll();
  res.json({ data: users });
});

// Endpoint de recuperação de contratos por empresa e data de início
app.get(
  "/api/contracts/:companyId/:inicio",
  authenticateToken,
  async (req, res) => {
    const { companyId, inicio } = req.params;
    console.log(
      "Recebido pedido para empresa com ID:",
      companyId,
      "com data de início:",
      inicio
    );

    try {
      const startDate = new Date(inicio);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      console.log("Consultando contratos entre:", startDate, "e", endDate);

      let contracts = await Contract.findAll({
        where: {
          CompanyId: companyId,
          data_inicio: {
            [Op.gte]: startDate,
            [Op.lt]: endDate,
          },
        },
      });

      console.log("Contratos localizados:", contracts);

      if (contracts.length > 0) {
        res.status(200).json({ data: contracts });
      } else {
        console.log(
          "Nenhum contrato localizado para empresa com  o ID ",
          companyId,
          "e data de início em ",
          inicio
        );
        res.status(404).json({ message: "Dados não localizados" });
      }
    } catch (error) {
      console.error("Erro procurando os contratos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  }
);

// Endpoint que retorna todas as empresas cadastradas
app.get("/api/companies", authenticateToken, async (req, res) => {
  try {
    const companies = await Company.findAll();

    if (companies.length > 0) {
      res.status(200).json({ data: companies });
    } else {
      res.status(404).json({ message: "Nenhuma empresa localizada" });
    }
  } catch (error) {
    console.error("Erro ao buscar empresas: ", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// Exemplo de criação de usuário
app.post("/api/users/create", async (req, res) => {
  try {
    let user = await User.create(req.body);

    res.status(201).json({ data: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Inicializando o servidor
app.listen(port, () => {
  console.log(`Servidor está rodando na porta ${port}`);
});

module.exports = { sequelize, User, Contract, Company };
