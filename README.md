# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Hardware ESP32

La app se conecta al ESP32 a través de Supabase. Para configurarlo:

1. Ejecutá `supabase/esp32.sql` en el SQL Editor de Supabase.
2. Cargá `esp32/esp32code/esp32code.ino` en el ESP32.
3. Seguí la guía completa en [`esp32/README.md`](esp32/README.md).

## Cámara en vivo (videovigilancia)

La app reproduce en vivo la webcam conectada a la PC, desde el celular y
desde cualquier lugar. También permite sacar capturas (no graba video).

1. En la PC, doble clic en [`camara/iniciar-camara.cmd`](camara/iniciar-camara.cmd).
2. Esperá la **URL PÚBLICA** que aparece en la ventana.
3. En la app: **Mi Barrio → Cámara en vivo → ⚙ → pegá la URL → GUARDAR**.

La PC tiene que quedar encendida con esa ventana abierta. Guía completa y
solución de problemas en [`camara/README.md`](camara/README.md).

> Si la app corre en el navegador de la PC, también se puede usar
> **Cámara en vivo → Cámara de este dispositivo** para ver la webcam directo.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
