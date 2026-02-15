import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";
import Icons from "unplugin-icons/vite";
import IconsResolver from "unplugin-icons/resolver";
import TurboConsole from "unplugin-turbo-console/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
    TurboConsole(),
    AutoImport({
      imports: ["vue", "vue-router", "pinia", "@vueuse/core"],
      dts: "src/auto-imports.d.ts",
      dirs: [
        "src/composables",
        "src/stores",
        "src/utils",
        "src/modules/**/composables",
        "src/modules/**/stores",
      ],
      vueTemplate: true,
    }),
    Components({
      dts: "src/components.d.ts",
      dirs: ["src/shared/components/**", "src/modules/**/components/**", "src/modules/**/views/**"],
      resolvers: [
        IconsResolver({
          prefix: "I",
          enabledCollections: ["mdi", "lucide"],
        }),
      ],
    }),
    Icons({
      autoInstall: true,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
