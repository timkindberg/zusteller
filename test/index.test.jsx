import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import constate from 'constate';
import * as React from 'react';
import { useReducer, useState } from 'react';
import create from '../src/index';

const debugEnabled = false;
const debug = (...args) => (debugEnabled ? console.log(...args) : void 0);
const tick = async (ms = 0) => await new Promise(res => setTimeout(res, ms));

describe('render count sanity checks', () => {
  it('renders a regular hook a baseline # of times', () => {
    const hookRender = jest.fn();
    const cmpRender = jest.fn();

    const useWelcome = () => {
      hookRender();
      return useState('Welcome');
    };
    const Title = () => {
      cmpRender();
      const [title] = useWelcome();
      return <h1>{title}</h1>;
    };

    render(<Title />);
    expect(hookRender.mock.calls).toHaveLength(1);
    expect(cmpRender.mock.calls).toHaveLength(1);
  });
});

describe('create', () => {
  it('Single useState', async () => {
    const cmpRender = jest.fn();
    const useTitle = create(() => useState('Welcome'));

    const Title = ({ id }) => {
      cmpRender();
      const [title] = useTitle();
      console.log(title);
      return (
        <h1>
          {title} {id}
        </h1>
      );
    };

    render(
      <>
        <Title id="1" />
        <Title id="2" />
      </>
    );

    expect(screen.getAllByRole('heading')[0].textContent).toEqual('Welcome 1');
    expect(screen.getAllByRole('heading')[1].textContent).toEqual('Welcome 2');
    expect(cmpRender.mock.calls).toHaveLength(2);
  });

  it('Double useState', async () => {
    const hookRender = jest.fn();
    const cmpRender = jest.fn();
    const useTitle = create(() => {
      hookRender();
      const [msg] = useState('Welcome');
      const [name] = useState('Tim');
      return `${msg}, ${name}`;
    });

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
      debug('Title Render');
      const title = useTitle(s => s[0]);
      debug('Title', title);
      return <h1>{title}</h1>;
    };

    const TitleInput = () => {
      titleInputRender();
      debug('TitleInput Render');
      const [title, setTitle] = useTitle();
      debug('TitleInput', title);
      return <input value={title} onChange={e => setTitle(e.target.value)} />;
    };

    const TitleButton = () => {
      titleButtonRender();
      debug('TitleButton Render');
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

    debug('----- type');
    await userEvent.paste(screen.getByRole('textbox'), ' to Hell!');
    await tick();
    expect(hookRender.mock.calls).toHaveLength(2); // nine letters typed
    expect(titleRender.mock.calls).toHaveLength(2);
    expect(titleInputRender.mock.calls).toHaveLength(2);
    expect(titleButtonRender.mock.calls).toHaveLength(1);
    expect(appRender.mock.calls).toHaveLength(1);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome to Hell!');

    act(() => {
      const [, setTitle] = useTitle.getState();
      setTitle('jk it is heaven');
    });

    expect(hookRender.mock.calls).toHaveLength(3);
    expect(titleRender.mock.calls).toHaveLength(3);
    expect(titleInputRender.mock.calls).toHaveLength(3);
    expect(titleButtonRender.mock.calls).toHaveLength(1);
    expect(appRender.mock.calls).toHaveLength(1);

    expect(screen.getByRole('heading').textContent).toEqual('jk it is heaven');
  });

  test('allows unmounting of the master component (not really a "master" anymore)', async () => {
    const useTitle = create(() => {
      return useState('Welcome');
    });

    const Title = () => {
      debug('Title Render');
      const title = useTitle(s => s[0]);
      debug('Title', title);
      return <h1>{title}</h1>;
    };

    const TitleInput = () => {
      debug('TitleInput Render');
      const [title, setTitle] = useTitle();
      debug('TitleInput', title);
      return <input value={title} onChange={e => setTitle(e.target.value)} />;
    };

    const TestBed = () => {
      const [removeTitle, setRemoveTitle] = useState(false);
      return (
        <>
          {!removeTitle && <Title />}
          <Title />
          <TitleInput />
          <button onClick={() => setRemoveTitle(true)}>Remove Title</button>
        </>
      );
    };

    render(<TestBed />);

    let headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(2);
    expect(headings[0].textContent).toEqual('Welcome');
    expect(headings[1].textContent).toEqual('Welcome');

    debug('----- unmount');
    userEvent.click(screen.getByRole('button'));

    debug('----- type');
    await userEvent.type(screen.getByRole('textbox'), ' to Hell!');
    await tick();

    headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toEqual('Welcome to Hell!');
  });

  describe('atomFamily', () => {
    it('makes one', async () => {
      const useFoo = create((arg = '') => {
        const [val, setVal] = useState('foo');
        debug('useFoo', { val, arg });
        return [val + arg, setVal];
      });
      expect(useFoo.family).toEqual({
        '[]': expect.any(Function),
      });

      const Foo1Cmp = () => {
        debug('foo1!');
        const [foo] = useFoo(['hello']);
        debug('foo1 hook result', foo);
        return <div>{foo}</div>;
      };

      const Foo2Cmp = () => {
        debug('foo2!');
        const [foo] = useFoo(['hello']);
        debug('foo2 hook result', foo);
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

      debug('!!! Render Test');
      render(<App />);

      expect(screen.getAllByText('foohello')).toHaveLength(2);
      expect(useFoo.family).toEqual({
        '[]': expect.any(Function),
        '["hello"]': expect.any(Function),
      });

      debug('!!! External setVal');
      act(() => {
        const [, setVal] = useFoo.getState(['hello']);
        setVal('bar');
      });

      expect(await screen.findAllByText('barhello')).toHaveLength(2);
      expect(screen.queryAllByText('foohello')).toHaveLength(0);
    });

    it('renders multiple with different args', async () => {
      const useGreeting = create(() => useState('Welcome'));
      const useFullGreeting = create(name => {
        const state = useGreeting();
        console.log('STATE', state);
        // I really hate that I have to set a fallback value here, because state is undefined for a tick :(
        // This will annoy devs
        const [greeting] = state;
        return `${greeting} ${name}`;
      });

      const GreetingTim = () => {
        debug('GreetingTim Render');
        const greeting = useFullGreeting(['Tim']);
        return <h1>{greeting}</h1>;
      };

      const GreetingBob = () => {
        debug('GreetingBob Render');
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

      let headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('Welcome Tim');
      expect(headings[1].textContent).toEqual('Welcome Bob');

      await userEvent.type(screen.getByRole('textbox'), ' to Hell!');

      headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('Welcome to Hell! Tim');
      expect(headings[1].textContent).toEqual('Welcome to Hell! Bob');

      act(() => {
        const [, setTitle] = useGreeting.getState();
        setTitle('jk it is heaven');
      });

      headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('jk it is heaven Tim');
      expect(headings[1].textContent).toEqual('jk it is heaven Bob');
    });

    it('renders multiple with different args nested', async () => {
      const useGreeting = create((divider = ' ') => {
        return useState('Welcome' + divider);
      });
      const useFullGreeting = create(name => {
        const [greeting] = useGreeting([' - ']);
        return `${greeting}${name}`;
      });

      const GreetingTim = () => {
        debug('GreetingTim Render');
        const greeting = useFullGreeting(['Tim']);
        return <h1>{greeting}</h1>;
      };

      const GreetingBob = () => {
        debug('GreetingBob Render');
        const greeting = useFullGreeting(['Bob']);
        return <h1>{greeting}</h1>;
      };

      const GreetingInput = () => {
        const [greeting, setGreeting] = useGreeting([' - ']);
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

      let headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('Welcome - Tim');
      expect(headings[1].textContent).toEqual('Welcome - Bob');

      await userEvent.type(screen.getByRole('textbox'), 'to Hell! ');

      headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('Welcome - to Hell! Tim');
      expect(headings[1].textContent).toEqual('Welcome - to Hell! Bob');

      act(() => {
        const [, setTitle] = useGreeting.getState([' - ']);
        setTitle('jk it is heaven ');
      });

      headings = screen.getAllByRole('heading');
      expect(headings[0].textContent).toEqual('jk it is heaven Tim');
      expect(headings[1].textContent).toEqual('jk it is heaven Bob');
    });

    it('changing hook args', async () => {
      const useUser = create((id = 'unknown') => {
        return useState('User ' + id)[0];
      });

      const UserSelector = () => {
        const [userId, setUserId] = useState(1);
        const user = useUser([userId]);
        return (
          <>
            <div>{user}</div>
            <input
              value={userId}
              onChange={e => setUserId(parseInt(e.target.value, 10))}
            />
          </>
        );
      };

      const TestBed = () => (
        <>
          <UserSelector />
        </>
      );

      expect(useUser.family).toEqual({
        '[]': expect.any(Function),
      });

      render(<TestBed />);

      expect(useUser.family).toEqual({
        '[1]': expect.any(Function),
        '[]': expect.any(Function),
      });

      screen.getByText('User 1');
      await userEvent.type(screen.getByRole('textbox'), '{selectall}2');
      screen.getByText('User 2');

      expect(useUser.family).toEqual({
        '[1]': expect.any(Function),
        '[2]': expect.any(Function),
        '[]': expect.any(Function),
      });
    });

    it('creates family outside react', () => {
      const useUser = create((id = 'unknown') => {
        return useState('User ' + id)[0];
      });
      expect(useUser.getState([3])).toEqual('User 3');
      expect(useUser.family).toEqual({
        '[3]': expect.any(Function),
        '[]': expect.any(Function),
      });
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
    const useStore = create(() => useState(0));
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
