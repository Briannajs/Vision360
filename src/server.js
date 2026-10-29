const http = require("http");

const servidor = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/api/estado") {
    res.end(
      JSON.stringify({
        mensaje: "Servidor funcionando correctamente",
        estado: "OK",
      }),
    );
  } else {
    res.end(
      JSON.stringify({
        mensaje: "Bienvenido a mi servidor Node.js",
      }),
    );
  }
});

servidor.listen(3000, () => {
  console.log("Servidor corriendo en el puerto 3000");
});
