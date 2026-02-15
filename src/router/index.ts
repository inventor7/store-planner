import { createRouter, createWebHistory } from "vue-router";
import { routes as storePlannerRoutes } from "@/modules/StorePlanner/router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "store-overview",
      component: () => import("@/modules/StorePlanner/views/StoreSetup.vue"),
    },
    ...storePlannerRoutes,
  ],
});

export default router;
