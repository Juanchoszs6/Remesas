import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function obtenerTokenSiigo(): Promise<string | null> {
  try {
    const response = await axios.post(
      process.env.SIIGO_AUTH_URL || "https://api.siigo.com/auth",
      {
        username: process.env.SIIGO_USERNAME,
        access_key: process.env.SIIGO_ACCESS_KEY,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Partner-Id": process.env.SIIGO_PARTNER_ID || "RemesasYMensajes",
        },
      }
    );

    console.log("Respuesta completa de Siigo:", response.data);
    return response.data.access_token;
  } catch (error: any) {
    console.error("Error al obtener el token:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return null;
  }
}
