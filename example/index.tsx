import 'react-app-polyfill/ie11';
import constate from 'constate';
import { Dispatch, SetStateAction, useState } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import create from '../.';

type StateTuple<S> = [S | undefined, Dispatch<SetStateAction<S | undefined>>];

const useDoubleStore = create<StateTuple<number>, number[]>((times = 1) => {
  const [count, setCount] = useState(0);
  return [count * times, setCount];
});
const [Provider, useCountContext] = constate(() => useState(0));

const Count = () => {
  console.log('Count render');
  const count = useDoubleStore([1], s => s[0]);
  return <div>{count}</div>;
};
const Doubles = () => {
  console.log('Count render');
  const count = useDoubleStore([2], s => s[0]);
  return <div>{count}</div>;
};

const Button = () => {
  console.log('Button render');
  const setCount = useDoubleStore(s => s[1]);
  return <button onClick={() => setCount(p => p! + 1)}>Click</button>;
};

const Count2 = () => {
  console.log('Count2 render');
  const [count] = useCountContext();
  return <div>{count}</div>;
};

const Button2 = () => {
  console.log('Button2 render');
  const [, setCount] = useCountContext();
  return <button onClick={() => setCount(p => p + 1)}>Click</button>;
};

export default function App() {
  console.log('App render');
  return (
    <>
      <Provider>
        <Count />
        <Doubles />
        <Button />
        <Count2 />
        <Button2 />
      </Provider>
    </>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
