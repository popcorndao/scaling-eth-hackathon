import { useState } from "react";

interface TokenInputProps {
  label: string;
  availableToken: number;
  handleClick: (amount: number) => Promise<void>;
  waiting: boolean;
  disabled?: boolean;
}

export default function TokenInput({
  label,
  availableToken,
  handleClick,
  waiting,
  disabled = false,
}: TokenInputProps): JSX.Element {
  const [tokenAmount, setTokenAmount] = useState<number>(0);

  return (
    <div className="flex flex-row items-center w-full border border-w rounded-md py-2 px-3">
      <input
        type="text"
        className="h-8 p-2 w-6/12 bg-gray-600 disabled:opacity-50"
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
        className="w-2/12 mr-2 disabled:opacity-50"
        disabled={disabled}
        onClick={() => setTokenAmount(availableToken)}
      >
        Max
      </button>
      <button
        className="w-4/12 w-border border-indigo-500 rounded-md py-2 bg-indigo-600 disabled:opacity-50"
        onClick={() => handleClick(tokenAmount)}
        disabled={disabled}
      >
        {waiting ? "..." : label}
      </button>
    </div>
  );
}
