// app/api/siigo/pruebas/testSiigoAuth.ts
import { obtenerTokenSiigo } from "../siigoAuth";
import dotenv from "dotenv";

dotenv.config();

(async () => {
  const token = await obtenerTokenSiigo();
  if (token) {
    console.log("✅ Token obtenido exitosamente:", token);
  } else {
    console.error("❌ No se pudo obtener el token.");
  }
})();
