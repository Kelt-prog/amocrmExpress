const AmoCRM = require("amocrm-js");
const fs = require("fs");
const currentToken = require("./token.json");
const express = require("express");
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const crm = new AmoCRM({
  // логин пользователя в портале, где адрес портала domain.amocrm.ru
  domain: "ilyagoryashin", // может быть указан полный домен вида domain.amocrm.ru, domain.amocrm.com
  /* 
      Информация об интеграции (подробности подключения 
      описаны на https://www.amocrm.ru/developers/content/oauth/step-by-step)
    */
  auth: {
    client_id: "9dfd7872-887f-4dd7-9093-c2b0e11a0082", // ID интеграции
    client_secret:
      "TFd6dV2INeEWNwaPUBJBDP6R9vacPI7Cx8PXmYhhKumxaSQJKMxHRCyB65GC5HMp", // Секретный ключ
    redirect_uri: "https://example.com", // Ссылка для перенаправления
    code: "" // Код авторизации
  }
});

crm.connect();

async function account() {
  const response = await crm.request("GET", "/api/v4/account");
  return response.data;
}

async function createLead(leadType, firstName, lastName, email, phone, city) {
  const leadTitle =
    leadType === "training-master"
      ? "Заявка от мастера производственного обучения"
      : "Заявка от курсанта на прохождение вебинара";
  //   return await crm.request.get("/api/v4/leads/tags");

  return await crm.request.post("/api/v4/leads/complex", [
    {
      name: leadTitle,
      _embedded: {
        tags: [
          {
            id: 493417,
            name: "РулиОнлайн"
          }
        ],
        contacts: [
          {
            first_name: firstName,
            last_name: lastName,
            custom_fields_values: [
              {
                field_id: 479021,
                values: [
                  {
                    enum_id: 846161,
                    value: email
                  }
                ]
              },
              {
                field_id: 479019,
                values: [
                  {
                    enum_id: 846151,
                    value: phone
                  }
                ]
              },
              {
                field_id: 691253,
                values: [
                  {
                    value: city
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]);
}

crm.on("connection:beforeConnect", () =>
  console.log("Ошибка connection:beforeConnect")
);
crm.on("connection:beforeFetchToken", () =>
  console.log("Ошибка connection:beforeFetchToken")
);
crm.on("connection:beforeRefreshToken", () => {
  console.log("Ошибка connection:beforeRefreshToken");
});
crm.on("connection:checkToken", () =>
  console.log("Ошибка connection:checkToken")
);
crm.on("connection:authError", err => {
  console.log("Ошибка connection:authError", err);
  crm.connection
    .refreshToken()
    .then(data => {
      console.log("refreshToken");
      fs.writeFileSync("./token.json", JSON.stringify(data.data));
    })
    .catch(err => {
      console.log("refresh err: ", err);
    });
});
crm.on("connection:connected", () => {
  console.log("connected");
});
crm.on("connection:error", () => console.log("Ошибка connection:error"));
crm.on("connection:newToken", token => {
  console.log("newToken");
  fs.writeFileSync("./token.json", JSON.stringify(token.data));
});

app.post("/amo/leads", (req, res) => {
  const errors = validate(req.body);

  if (errors.length > 0) {
    res.status(400).send(`Required fileds: ${errors.join(", ")}`);
    return;
  }

  try {
    crm.connection.setToken(currentToken, 0);
    createLead(
      req.body?.leadType,
      req.body?.firstName,
      req.body?.lastName,
      req.body?.email,
      req.body?.phone,
      req.body?.city
    )
      .then(data => {
        console.log(JSON.stringify(data?.data));
        console.log(data?.data?.status);
        res
          .status(data.data.status || 200)
          .send(data?.data?.detail || "Lead created");
      })
      .catch(err => {
        console.log("err", err);
        res.status(500).send("Error adding new lead");
      });
  } catch (e) {
    console.log("catch error", e);
  }
});

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`);
});

const validate = req => {
  const errors = [];

  if (!req.leadType) errors.push("leadType");
  if (!req.firstName) errors.push("firstName");
  if (!req.lastName) errors.push("lastName");
  if (!req.phone) errors.push("phone");
  if (!req.email) errors.push("email");
  if (!req.city) errors.push("city");

  return errors;
};
