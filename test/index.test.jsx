import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import constate from 'constate';
import * as React from 'react';
import { useReducer, useState } from 'react';
import create from '../src/index';

describe('render count sanity checks', () => {
  it('renders a baseline # of times', () => {
    const hookRender = jest.fn();
    const cmpRender = jest.fn();

    const useWelcome = () => {
      hookRender();
      return useState('Welcome');
    };
    const Title = () => {
      cmpRender();
      const title = useWelcome();
      return <h1>{title}</h1>;
    };

    render(<Title />);
    expect(hookRender.mock.calls).toHaveLength(1);
    expect(cmpRender.mock.calls).toHaveLength(1);
  });
});

describe('create', () => {
  it('accepts hook args during create (simple)', async () => {
    const cmpRender = jest.fn();
    const useTitle = create(useState, 'Welcome');

    const Title = () => {
      cmpRender();
      const title = useTitle(s => s[0]);
      return <h1>{title}</h1>;
    };

    render(<Title />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome');
    expect(cmpRender.mock.calls).toHaveLength(1);
  });

  it('accepts hook args during create (multiple)', async () => {
    const hookRender = jest.fn();
    const cmpRender = jest.fn();
    const useTitle = create(
      (initialMsg, initialName) => {
        hookRender();
        const [msg] = useState(initialMsg);
        const [name] = useState(initialName);
        return `${msg}, ${name}`;
      },
      'Welcome',
      'Tim'
    );

    const Title = () => {
      cmpRender();
      const welcomeMsg = useTitle();
      return <h1>{welcomeMsg}</h1>;
    };

    render(<Title />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome, Tim');
    expect(hookRender.mock.calls).toHaveLength(1);
    expect(cmpRender.mock.calls).toHaveLength(1);
  });

  test('basic useState example', async () => {
    const hookRender = jest.fn();
    const titleRender = jest.fn();
    const titleInputRender = jest.fn();
    const titleButtonRender = jest.fn();
    const appRender = jest.fn();

    const useTitle = create(() => {
      hookRender();
      return useState('Welcome');
    });

    const Title = () => {
      titleRender();
      const title = useTitle(s => s[0]);
      return <h1>{title}</h1>;
    };

    const TitleInput = () => {
      titleInputRender();
      const [title, setTitle] = useTitle();
      return <input value={title} onChange={e => setTitle(e.target.value)} />;
    };

    const TitleButton = () => {
      titleButtonRender();
      const setTitle = useTitle(s => s[1]);
      return <button onClick={() => setTitle('Welcome!')} />;
    };

    const TestBed = () => {
      appRender();
      return (
        <>
          <Title />
          <TitleInput />
          <TitleButton />
        </>
      );
    };

    render(<TestBed />);
    expect(hookRender.mock.calls).toHaveLength(1);
    expect(titleRender.mock.calls).toHaveLength(1);
    expect(titleInputRender.mock.calls).toHaveLength(1);
    expect(titleButtonRender.mock.calls).toHaveLength(1);
    expect(appRender.mock.calls).toHaveLength(1);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome');

    await userEvent.type(screen.getByRole('textbox'), ' to Hell!');
    expect(hookRender.mock.calls).toHaveLength(10); // nine letters typed
    expect(titleRender.mock.calls).toHaveLength(10);
    expect(titleInputRender.mock.calls).toHaveLength(10);
    expect(titleButtonRender.mock.calls).toHaveLength(1);
    expect(appRender.mock.calls).toHaveLength(1);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome to Hell!');

    act(() => {
      const [, setTitle] = useTitle.getState();
      setTitle('jk it is heaven');
    });

    expect(hookRender.mock.calls).toHaveLength(11);
    expect(titleRender.mock.calls).toHaveLength(11);
    expect(titleInputRender.mock.calls).toHaveLength(11);
    expect(titleButtonRender.mock.calls).toHaveLength(1);
    expect(appRender.mock.calls).toHaveLength(1);

    expect(screen.getByRole('heading').textContent).toEqual('jk it is heaven');
  });

  describe('atomFamily (WIP)', () => {
    it('makes one', () => {
      const useFoo = create((arg = '') => {
        const [val, setVal] = useState('foo');
        console.log('useFoo', { val, arg });
        return [val + arg, setVal];
      });
      expect(useFoo.family).toEqual({});

      const Foo1Cmp = () => {
        console.log('foo1');
        console.log('foo1 hook result', useFoo());
        const [foo] = useFoo() ?? [];
        return <div>{foo}</div>;
      };

      const Foo2Cmp = () => {
        console.log('foo2');
        console.log('foo2 hook result', useFoo());
        const [foo] = useFoo() ?? [];
        return <div>{foo}</div>;
      };

      const App = () => {
        return (
          <>
            <Foo1Cmp />
            <Foo2Cmp />
          </>
        );
      };

      render(<App />);

      expect(screen.getAllByText('foo')).toHaveLength(2);
      expect(useFoo.family).toEqual({
        undefined: { node: expect.anything(), storeHook: expect.anything() },
      });

      act(() => {
        const [, setVal] = useFoo.getState();
        setVal('bar');
      });

      expect(screen.queryAllByText('foo')).toHaveLength(0);
      expect(screen.getAllByText('bar')).toHaveLength(2);
    });

    it('does things', async () => {
      const useGreeting = create(() => {
        return useState('Welcome');
      });
      const useFullGreeting = create(name => {
        const [greeting] = useGreeting();
        return `${greeting} ${name}`;
      });

      const GreetingTim = () => {
        const greeting = useFullGreeting(['Tim']);
        return <h1>{greeting}</h1>;
      };

      const GreetingBob = () => {
        const greeting = useFullGreeting(['Bob']);
        return <h1>{greeting}</h1>;
      };

      const GreetingInput = () => {
        const [greeting, setGreeting] = useGreeting();
        return (
          <input value={greeting} onChange={e => setGreeting(e.target.value)} />
        );
      };

      const TestBed = () => (
        <>
          <GreetingTim />
          <GreetingBob />
          <GreetingInput />
        </>
      );

      render(<TestBed />);

      expect(screen.getByRole('heading').textContent).toEqual('Welcome');

      await userEvent.type(screen.getByRole('textbox'), ' to Hell!');

      expect(screen.getByRole('heading').textContent).toEqual(
        'Welcome to Hell!'
      );

      act(() => {
        const [, setTitle] = useTitle.getState();
        setTitle('jk it is heaven');
      });

      expect(screen.getByRole('heading').textContent).toEqual(
        'jk it is heaven'
      );
    });
  });

  test('basic useReducer example', async () => {
    const useStatus = create(() => {
      return useReducer(
        (state, action) => {
          if (action.type === 'start') return { status: 'started' };
          if (action.type === 'stop') return { status: 'stopped' };
          return state;
        },
        { status: 'stopped' }
      );
    });

    const Status = () => {
      const status = useStatus(s => s[0].status);
      return <h1>{status}</h1>;
    };

    const StartButton = () => {
      const dispatch = useStatus(s => s[1]);
      return <button onClick={() => dispatch({ type: 'start' })}>Start</button>;
    };

    const StopButton = () => {
      const dispatch = useStatus(s => s[1]);
      return <button onClick={() => dispatch({ type: 'stop' })}>Stop</button>;
    };

    const TestBed = () => {
      return (
        <>
          <Status />
          <StartButton />
          <StopButton />
        </>
      );
    };

    render(<TestBed />);

    expect(screen.getByRole('heading').textContent).toEqual('stopped');
    userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('heading').textContent).toEqual('started');
    userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('heading').textContent).toEqual('stopped');

    act(() => {
      const [, dispatch] = useStatus.getState();
      dispatch({ type: 'start' });
    });
    expect(screen.getByRole('heading').textContent).toEqual('started');
  });

  test('composition', async () => {
    const useMsg = create(() => {
      return useState('Welcome');
    });
    const useName = create(() => {
      return useState('Tim');
    });

    const useWelcomeMsg = () => {
      const msg = useMsg(s => s[0]);
      const name = useName(s => s[0]);
      return `${msg}, ${name}`;
    };

    const Title = () => {
      const welcomeMsg = useWelcomeMsg();
      return <h1>{welcomeMsg}</h1>;
    };

    const Article = () => {
      const welcomeMsg = useWelcomeMsg();
      return <article>{welcomeMsg}</article>;
    };

    const Edit = () => {
      const [msg, setMsg] = useMsg();
      const [name, setName] = useName();
      return (
        <>
          <input
            aria-label="Msg"
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <input
            aria-label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </>
      );
    };

    const TestBed = () => {
      return (
        <>
          <Title />
          <Article />
          <Edit />
        </>
      );
    };

    render(<TestBed />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome, Tim');
    expect(screen.getByRole('article').textContent).toEqual('Welcome, Tim');

    const msgInput = screen.getByRole('textbox', {
      name: 'Msg',
    });
    const nameInput = screen.getByRole('textbox', {
      name: 'Name',
    });

    expect(msgInput.value).toEqual('Welcome');
    expect(nameInput.value).toEqual('Tim');

    userEvent.type(msgInput, '{selectall}Good Riddance');
    userEvent.type(
      nameInput,
      '{selectall}proprietary state objects and React Providers!'
    );

    expect(screen.getByRole('heading').textContent).toEqual(
      'Good Riddance, proprietary state objects and React Providers!'
    );
    expect(screen.getByRole('article').textContent).toEqual(
      'Good Riddance, proprietary state objects and React Providers!'
    );

    act(() => {
      const [, setMsg] = useMsg.getState();
      const [, setName] = useName.getState();
      setMsg('Welcome to the future');
      setName('React Devs');
    });

    expect(screen.getByRole('heading').textContent).toEqual(
      'Welcome to the future, React Devs'
    );
  });

  test('composition 2', async () => {
    const useMsg = () => {
      return useState('Welcome');
    };
    const useName = () => {
      return useState('Tim');
    };

    const useWelcomeMsg = create(() => {
      const [msg, setMsg] = useMsg();
      const [name, setName] = useName();
      return { welcomeMsg: `${msg}, ${name}`, msg, setMsg, name, setName };
    });

    const Title = () => {
      const welcomeMsg = useWelcomeMsg(s => s.welcomeMsg);
      return <h1>{welcomeMsg}</h1>;
    };

    const Article = () => {
      const welcomeMsg = useWelcomeMsg(s => s.welcomeMsg);
      return <article>{welcomeMsg}</article>;
    };

    const Edit = () => {
      const { msg, setMsg, name, setName } = useWelcomeMsg(
        ({ welcomeMsg, ...rest }) => rest
      );
      return (
        <>
          <input
            aria-label="Msg"
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <input
            aria-label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </>
      );
    };

    const TestBed = () => {
      return (
        <>
          <Title />
          <Article />
          <Edit />
        </>
      );
    };

    render(<TestBed />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome, Tim');
    expect(screen.getByRole('article').textContent).toEqual('Welcome, Tim');

    const msgInput = screen.getByRole('textbox', {
      name: 'Msg',
    });
    const nameInput = screen.getByRole('textbox', {
      name: 'Name',
    });

    expect(msgInput.value).toEqual('Welcome');
    expect(nameInput.value).toEqual('Tim');

    userEvent.type(msgInput, '{selectall}Good Riddance');
    userEvent.type(
      nameInput,
      '{selectall}proprietary state objects and React Providers!'
    );

    expect(screen.getByRole('heading').textContent).toEqual(
      'Good Riddance, proprietary state objects and React Providers!'
    );
    expect(screen.getByRole('article').textContent).toEqual(
      'Good Riddance, proprietary state objects and React Providers!'
    );

    act(() => {
      const { setMsg, setName } = useWelcomeMsg.getState();
      setMsg('Welcome to the future');
      setName('React Devs');
    });

    expect(screen.getByRole('heading').textContent).toEqual(
      'Welcome to the future, React Devs'
    );
  });

  test('render counts compared to context', () => {
    const stellerCountRender = jest.fn();
    const stellerButtonRender = jest.fn();
    const contextCountRender = jest.fn();
    const contextButtonRender = jest.fn();
    const appRender = jest.fn();
    const useStore = create(useState, 0);
    const [Provider, useCountContext] = constate(() => useState(0));

    const StellerCount = () => {
      stellerCountRender();
      const count = useStore(s => s[0]);
      return <div>{count}</div>;
    };

    const StellerButton = () => {
      stellerButtonRender();
      const setCount = useStore(s => s[1]);
      return <button onClick={() => setCount(p => p + 1)}>Steller</button>;
    };

    const ContextCount = () => {
      contextCountRender();
      const [count] = useCountContext();
      return <div>{count}</div>;
    };

    const ContextButton = () => {
      contextButtonRender();
      const [, setCount] = useCountContext();
      return <button onClick={() => setCount(p => p + 1)}>Context</button>;
    };

    function App() {
      appRender();
      return (
        <Provider>
          <StellerCount />
          <StellerButton />
          <ContextCount />
          <ContextButton />
        </Provider>
      );
    }

    render(<App />);

    expect(stellerCountRender).toBeCalledTimes(1);
    expect(stellerButtonRender).toBeCalledTimes(1);
    expect(contextCountRender).toBeCalledTimes(1);
    expect(contextButtonRender).toBeCalledTimes(1);
    expect(appRender).toBeCalledTimes(1);

    userEvent.click(screen.getByText('Steller'));

    expect(stellerCountRender).toBeCalledTimes(2);
    expect(stellerButtonRender).toBeCalledTimes(1);
    expect(contextCountRender).toBeCalledTimes(1);
    expect(contextButtonRender).toBeCalledTimes(1);
    expect(appRender).toBeCalledTimes(1);

    userEvent.click(screen.getByText('Context'));

    expect(stellerCountRender).toBeCalledTimes(2);
    expect(stellerButtonRender).toBeCalledTimes(1);
    expect(contextCountRender).toBeCalledTimes(2);
    expect(contextButtonRender).toBeCalledTimes(2);
    expect(appRender).toBeCalledTimes(1);
  });
});