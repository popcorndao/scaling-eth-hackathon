import { useState, useEffect } from 'react';

interface TokenInputProps {
  label: string;
  tokenName: string;
  availableToken: number;
  handleClick: (amount: number) => Promise<void>;
  waiting: boolean;
  direction: "col" | "row";
  disabled?: boolean;
}

export default function TokenInput({
  label,
  tokenName,
  availableToken,
  handleClick,
  waiting,
  direction,
  disabled = false,
}: TokenInputProps): JSX.Element {
  const [tokenAmount, setTokenAmount] = useState<number>(0);
  useEffect(() => {
    setTokenAmount(0);
  }, [waiting])

  return (
    <div
      className={`flex ${
        direction === "col" ? "flex-col" : "flex-row"
      } items-center w-full rounded-md`}
    >
      <span
        className={`flex flex-row ${direction === "col" ? "w-5/12" : "w-7/12"} items-center`}
      >
        <input
          type="text"
          className="h-8 p-2 mr-1 w-6/12 bg-transparent disabled:opacity-50"
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
        <p className="w-4/12 mr-1 text-lg">{tokenName}</p>
        <button
          className={`w-4/12 button button-secondary ${direction === "col" ? "" : "mr-2"} disabled:opacity-50`}
          disabled={disabled}
          type="button"
          onClick={() => setTokenAmount(availableToken)}
        >
          Max
        </button>
      </span>
      <button
        className="w-5/12 button button-primary"
        type="button"
        onClick={() => handleClick(tokenAmount)}
        disabled={disabled}
      >
        {waiting ? "..." : label}
      </button>
    </div>
  );
}
