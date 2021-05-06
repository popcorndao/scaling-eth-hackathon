import { BrowserRouter, Redirect, Route, Switch } from "react-router-dom";
import Bridge from "./pages/Bridge";
import Pool from "./pages/Pool";

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/bridge" component={Bridge} />
        <Route exact path="/pool" component={Pool} />
        <Redirect exact from="/" to="/bridge" />
      </Switch>
    </BrowserRouter>
  );
}
