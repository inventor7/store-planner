import { reactive, ref } from "vue";
import { createGlobalState, useEventBus } from "@vueuse/core";

export interface MessageBoxOptions {
  icon: string;
  iconColor: string;
  message: string;
  acceptButtonShow: boolean;
  acceptButtonLabel: string;
  rejectButtonShow: boolean;
  rejectButtonLabel: string;
  timer?: number;
}

const DefaultAlertParams: MessageBoxOptions = {
  icon: "mdi-alert-outline",
  iconColor: "warning",

  message: "",

  acceptButtonShow: true,
  acceptButtonLabel: "ok",

  rejectButtonShow: true,
  rejectButtonLabel: "cancel",
};

const useMessageBoxState = createGlobalState(() => {
  const params: MessageBoxOptions = reactive({
    ...DefaultAlertParams,
  });

  const isOpen = ref(false);

  const submit = useEventBus<boolean>("messageBox");

  return {
    params,
    isOpen,
    onSubmit: submit.on,
    submit: submit.emit,
  };
});

export function useMessageBox() {
  const { isOpen, onSubmit, params, submit } = useMessageBoxState();

  const open = (msgBoxParam: Partial<MessageBoxOptions>) => {
    Object.assign(params, DefaultAlertParams, msgBoxParam);
    isOpen.value = true;

    return new Promise((resolve) => onSubmit(resolve));
  };

  const confirm = (params: Partial<MessageBoxOptions>) => open({ ...params });

  const alert = (params: Partial<MessageBoxOptions>) =>
    open({
      icon: "mdi-check",
      iconColor: "green",
      rejectButtonShow: false,
      ...params,
    });

  const error = (params: Partial<MessageBoxOptions>) =>
    open({
      icon: "mdi-alert-circle",
      iconColor: "error",
      rejectButtonShow: false,
      ...params,
    });

  const warning = (params: Partial<MessageBoxOptions>) =>
    open({
      icon: "mdi-alert",
      iconColor: "warning",
      rejectButtonShow: false,
      ...params,
    });

  const reject = () => {
    isOpen.value = false;
    submit(false);
  };

  const accept = () => {
    isOpen.value = false;
    submit(true);
  };

  return {
    params,
    isOpen,

    reject,
    accept,

    confirm,
    alert,
    error,
    warning,
  };
}
