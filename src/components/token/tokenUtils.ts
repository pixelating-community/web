export const resolveTokenInputValue = (
  inputValue: string | null | undefined,
  stateValue: string | null | undefined,
) => {
  const normalizedInput =
    typeof inputValue === "string" ? inputValue.trim() : "";
  if (normalizedInput.length > 0) return normalizedInput;
  const normalizedState =
    typeof stateValue === "string" ? stateValue.trim() : "";
  return normalizedState;
};
