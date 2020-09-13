import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useReducer, useState } from 'react';
import create from '../src';

describe('create', () => {
  it('accepts hook args during create (simple)', async () => {
    const useTitle = create<[string, Function]>(useState, 'Welcome');

    const Title = () => {
      const title = useTitle(s => s[0]);
      return <h1>{title}</h1>;
    };

    render(<Title />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome');
  });

  it('accepts hook args during create (multiple)', async () => {
    const useTitle = create<string>(
      (initialMsg: string, initialName: string) => {
        const [msg] = useState(initialMsg);
        const [name] = useState(initialName);
        return `${msg}, ${name}`;
      },
      'Welcome',
      'Tim'
    );

    const Title = () => {
      const welcomeMsg = useTitle();
      return <h1>{welcomeMsg}</h1>;
    };

    render(<Title />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome, Tim');
  });

  test('basic useState example', async () => {
    const useTitle = create<[string, Function]>(() => useState('Welcome'));

    const Title = () => {
      const title = useTitle(s => s[0]);
      return <h1>{title}</h1>;
    };

    const TitleInput = () => {
      const [title, setTitle] = useTitle();
      return <input value={title} onChange={e => setTitle(e.target.value)} />;
    };

    const TestBed = () => {
      return (
        <>
          <Title />
          <TitleInput />
        </>
      );
    };

    render(<TestBed />);

    expect(screen.getByRole('heading').textContent).toEqual('Welcome');

    await userEvent.type(screen.getByRole('textbox'), ' to Hell!');

    expect(screen.getByRole('heading').textContent).toEqual('Welcome to Hell!');

    act(() => {
      const [, setTitle] = useTitle.getState();
      setTitle('jk it is heaven');
    });

    expect(screen.getByRole('heading').textContent).toEqual('jk it is heaven');
  });

  test('basic useReducer example', async () => {
    type State = { status: string };
    type Action = { type: 'start' | 'stop' };
    const useStatus = create<[State, Function]>(() => {
      return useReducer(
        (state: State, action: Action) => {
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
    const useMsg = create<[string, Function]>(() => {
      return useState('Welcome');
    });
    const useName = create<[string, Function]>(() => {
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

    const msgInput: HTMLInputElement = screen.getByRole('textbox', {
      name: 'Msg',
    }) as HTMLInputElement;
    const nameInput: HTMLInputElement = screen.getByRole('textbox', {
      name: 'Name',
    }) as HTMLInputElement;

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

    type useWelcomeMsgState = {
      welcomeMsg: string;
      msg: string;
      name: string;
      setMsg: Function;
      setName: Function;
    };
    const useWelcomeMsg = create<useWelcomeMsgState>(() => {
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

    const msgInput: HTMLInputElement = screen.getByRole('textbox', {
      name: 'Msg',
    }) as HTMLInputElement;
    const nameInput: HTMLInputElement = screen.getByRole('textbox', {
      name: 'Name',
    }) as HTMLInputElement;

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
});
