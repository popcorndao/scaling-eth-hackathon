interface AvailableTokenProps {
  network: string;
  icon: string;
  availableToken: number;
  tokenName: string;
}

export default function AvailableToken({
  network,
  icon,
  availableToken,
  tokenName,
}: AvailableTokenProps): JSX.Element {
  return (
    <div className="w-1/3 flex flex-row">
      <div className="flex flex-row items-center justify-center bg-white rounded-lg shadow-md w-full py-8">
          <img className="w-16 h-16 rounded-full mr-4" src={icon} alt="network-icon" />
        <div className="">
          <h2 className="font-bold text-4xl">{network}</h2>
          <span className="flex flex-row justify-between mt-2">
            <p className="text-2xl">{availableToken ?? 0}</p>
            <p className="text-2xl">{tokenName}</p>
          </span>
        </div>
      </div>
    </div>
  );
}
