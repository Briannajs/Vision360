import { supabase } from "./supabase";

/** El correo ya tiene una cuenta: no se puede volver a registrar. */
export class CorreoYaRegistradoError extends Error {
  constructor() {
    super(
      "Ya existe una cuenta con este correo electrónico. Iniciá sesión o recuperá tu contraseña.",
    );
    this.name = "CorreoYaRegistradoError";
  }
}

/** Supabase esconde el duplicado de distintas formas según la configuración. */
const esCorreoDuplicado = (error: { code?: string; message?: string }) => {
  const codigo = (error.code ?? "").toLowerCase();
  const mensaje = (error.message ?? "").toLowerCase();

  return (
    codigo === "user_already_exists" ||
    codigo === "email_exists" ||
    mensaje.includes("already registered") ||
    mensaje.includes("already been registered") ||
    mensaje.includes("user already exists")
  );
};

// ✅ Registro
export const registrarUsuario = async (
  email: string,
  password: string,
  nombreCompleto: string,
) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        nombre_completo: nombreCompleto,
      },
      // 👇 Esto le dice a Supabase a dónde redirigir después de confirmar el correo
      emailRedirectTo: "vision360://",
    },
  });

  if (error) {
    if (esCorreoDuplicado(error)) throw new CorreoYaRegistradoError();
    throw error;
  }

  if (!data.user) {
    throw new Error("No se pudo crear la cuenta. Intentá de nuevo.");
  }

  // Con la confirmación por correo activada, Supabase no devuelve error para
  // un correo ya registrado: devuelve un usuario "vacío", sin identidades,
  // justamente para no revelar si la cuenta existe. Lo detectamos acá para
  // no mostrarle al usuario que la cuenta se creó cuando en realidad no.
  if (
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    throw new CorreoYaRegistradoError();
  }

  return data.user;
};

// ✅ Login

/** Traducimos los errores de Supabase para que se entiendan en la app. */
const mensajeDeLogin = (error: { message?: string; status?: number }) => {
  const mensaje = (error.message ?? "").toLowerCase();

  if (mensaje.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (mensaje.includes("email not confirmed"))
    return "Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.";
  if (mensaje.includes("too many requests") || error.status === 429)
    return "Demasiados intentos. Esperá unos segundos y probá de nuevo.";
  if (mensaje.includes("failed to fetch") || mensaje.includes("network"))
    return "No se pudo conectar. Revisá tu conexión a internet.";
  if (mensaje.includes("invalid email"))
    return "El correo ingresado no es válido.";

  return error.message || "No se pudo iniciar sesión. Intentá de nuevo.";
};

export const iniciarSesion = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    console.log("ERROR AUTH:", error.message);
    throw new Error(mensajeDeLogin(error));
  }

  return data.user;
};

// ✅ Cerrar sesión
export const cerrarSesion = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// ✅ Recuperar contraseña
export const recuperarPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "vision360://", // También redirigimos aquí por si el usuario cambia la clave
  });
  if (error) throw error;
};
