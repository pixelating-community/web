import { QueryClient } from "@tanstack/react-query";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { getRouter } from "../src/router";

export default createStartHandler({
  createRouter: () => getRouter(new QueryClient()),
})(defaultStreamHandler);
