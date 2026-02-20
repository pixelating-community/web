import { QueryClient } from "@tanstack/react-query";
import { StartClient } from "@tanstack/react-start";
import { hydrateRoot } from "react-dom/client";
import { getRouter } from "../src/router";

const router = getRouter(new QueryClient());

hydrateRoot(document, <StartClient router={router} />);
