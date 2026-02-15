import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { PiniaColada } from "@pinia/colada";

import App from "./App.vue";
import router from "./router";
import i18n from "./shared/plugins/i18n";
import VueKonva from "vue-konva";

import "./assets/index.css";

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(PiniaColada as any); // Type assertion needed for Vue 3 beta/Pinia Colada compatibility
app.use(router);
app.use(i18n);
app.use(VueKonva);

app.mount("#app");
