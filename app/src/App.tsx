import { BrowserRouter, Redirect, Route, Switch } from "react-router-dom";
import Layer1 from "./pages/Layer1";
import Layer2 from "./pages/Layer2";

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/layer1" component={Layer1} />
        <Route exact path="/layer2" component={Layer2} />
        <Redirect exact from="/" to="/layer1" />
      </Switch>
    </BrowserRouter>
  );
}
