import { useRouterState } from "@tanstack/react-router";
import * as chapterRoutes from "@/lib/chapterRoutes";
import * as topicRoutes from "@/lib/topicRoutes";

export const useContentRoutes = () => {
  const isChapter = useRouterState({
    select: (state) => state.location.pathname.startsWith("/c/"),
  });
  return isChapter ? chapterRoutes : topicRoutes;
};
