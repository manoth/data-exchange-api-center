import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Data Exchange Tools API v0.1.0 running on http://127.0.0.1:${env.PORT}`);
});
