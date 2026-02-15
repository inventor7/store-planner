import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "store-planner-setup",
    component: () => import("./views/StoreSetup.vue"),
  },
  {
    path: "/store-planner/editor/:partnerId",
    name: "partner-store-plan",
    component: () => import("./views/StoreEditor.vue"),
    props: true,
  },
];
