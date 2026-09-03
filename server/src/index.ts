import "dotenv/config";
import { createApp } from "./app";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

createApp().listen(port, () => {
  console.log(`STOBA 95 elections server listening on :${port}`);
});
