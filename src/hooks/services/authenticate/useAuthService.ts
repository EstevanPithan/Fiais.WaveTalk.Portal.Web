import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { AUTH_TOKEN } from "../../../constants/query-client-constants";
import { authenticate, AuthenticateVariables } from "../../../requests/auth/authenticate";
import { useStorage } from "../../useStorage";
import { ResponseError } from "../../../common/ResponseError";
import { UserInfo } from "../../../common/UserInfo";
import { enqueueSnackbar } from "notistack";
import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { chatApi } from "../../../config/api";
import { useDispatch } from "react-redux";
import { setConnection } from "../../../redux/connection/slice";

export const useAuthService = () => {
  const { getStorageItem, setStorageItem, removeStorageItem } = useStorage();
  const dispatch = useDispatch();
  const conn = new HubConnectionBuilder()
    .withUrl(chatApi)
    .build();

  const navigate = useNavigate();
  const authenticateMutation = useMutation({
    mutationFn: authenticate,
    onError: (error: AxiosError<ResponseError>) => {
      enqueueSnackbar(error.response?.data.Message, { variant: "error" });
    },
    onSuccess: async (data) => {
      setStorageItem(AUTH_TOKEN, data.data);
      const user = getInfoToken();
      navigate("/chat");

      dispatch(setConnection(conn))
      if (conn.state == HubConnectionState.Disconnected) await conn.start();
      await conn.invoke("JoinChat", user?.id);
    },
  });
  const queryClient = useQueryClient();

  const login = (loginData: AuthenticateVariables) => {
    authenticateMutation.mutate(loginData);
  };

  const logout = () => {
    removeStorageItem(AUTH_TOKEN);
    queryClient.clear();
    navigate("/login");
  };

  const isAuthenticated = () => {
    return Boolean(getStorageItem(AUTH_TOKEN));
  };

  const getInfoToken = () => {
    const token = getStorageItem(AUTH_TOKEN);
    if (!token) {
      return null;
    }

    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload) as UserInfo;
  };

  return {
    login,
    logout,
    isAuthenticated,
    loading: authenticateMutation.isPending,
    getInfoToken,
  };
};
