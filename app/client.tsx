import { StartClient } from "@tanstack/react-start";
import { hydrateRoot } from "react-dom/client";
import { getRouter } from "../src/router";

const router = getRouter();

hydrateRoot(document, <StartClient router={router} />);
