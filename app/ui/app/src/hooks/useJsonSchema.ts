import { useState, useCallback } from "react";

export function useJsonSchema() {
  const [active, setActive] = useState(false);
  const [schema, setSchema] = useState("");

  const toggle = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        setSchema("");
      }
      return !prev;
    });
  }, []);

  const setSchemaValue = useCallback((value: string) => {
    setSchema(value);
    if (value.trim()) {
      setActive(true);
    }
  }, []);

  return {
    active,
    schema,
    toggle,
    setSchema: setSchemaValue,
  };
}
