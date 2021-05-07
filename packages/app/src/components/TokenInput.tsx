import { useState } from "react";

interface TokenInputProps {
  label: string;
  availableToken: number;
  handleClick: (amount: number) => Promise<void>;
  waiting: boolean;
  direction: "col" | "row";
  disabled?: boolean;
}

export default function TokenInput({
  label,
  availableToken,
  handleClick,
  waiting,
  direction,
  disabled = false,
}: TokenInputProps): JSX.Element {
  const [tokenAmount, setTokenAmount] = useState<number>(0);

  return (
    <div
      className={`flex ${
        direction === "col" ? "flex-col" : "flex-row"
      } items-center w-full rounded-md`}
    >
      <span
        className={`flex flex-row ${direction === "col" ? "w-5/12" : "w-7/12"}`}
      >
        <input
          type="text"
          className="h-8 p-2 mr-2 w-8/12 bg-transparent disabled:opacity-50"
          value={tokenAmount}
          onChange={(e) =>
            setTokenAmount(
              Number(e.target.value) > availableToken
                ? availableToken
                : Number(e.target.value)
            )
          }
          disabled={disabled}
        />
        <button
          className={`w-4/12 ${direction === "col" ? "" : "mr-2"} disabled:opacity-50`}
          disabled={disabled}
          onClick={() => setTokenAmount(availableToken)}
        >
          Max
        </button>
      </span>
      <button
        className="w-5/12 button button-primary mt-2"
        onClick={() => handleClick(tokenAmount)}
        disabled={disabled}
      >
        {waiting ? "..." : label}
      </button>
    </div>
  );
}
