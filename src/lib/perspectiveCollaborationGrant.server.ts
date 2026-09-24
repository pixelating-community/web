import "@tanstack/react-start/server-only";
import {
  getReflectionWriteCookieName,
  verifyReflectionAccessToken,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { getRequestCookie } from "@/server/lib/requestCookies";

export const hasPerspectiveCollaborationGrant = ({
  request,
  perspectiveId,
}: {
  request: Request;
  perspectiveId: string;
}) => {
  const accessToken = getRequestCookie(request, `p_${perspectiveId}`);
  const writeToken = getRequestCookie(
    request,
    getReflectionWriteCookieName(perspectiveId),
  );

  return (
    verifyReflectionAccessToken(accessToken, perspectiveId) &&
    verifyReflectionWriteToken(writeToken, perspectiveId)
  );
};
