import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { User } from "../api/types";

export function useRequireAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = useRef(`${location.pathname}${location.search}${location.hash}`);
  returnTo.current = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {
        if (active) {
          navigate("/login", { replace: true, state: { from: returnTo.current } });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  return { user, loading };
}
