const hat = require('hat');
const Dispatcher = require('./dispatcher');

const noop = (argv) => argv;


class Action {

  static create(handler, dispatcher) {
    const action = new Action(handler, dispatcher, true);

    return action.wrapper;
  }

  constructor(handler, dispatcher, hasError) {
    this.dispatcher = dispatcher || Dispatcher.main;
    this.actionType = hat();
    this.handler = handler;
    this.prefill = [];
    this.wrapper = this.buildWrapper();

    if (hasError) {
      this.error = new Action(noop, this.dispatcher, false);
      this.wrapper.error = this.error.wrapper;
    }
  }

  buildWrapper() {
    const wrapper = (...argv) => this.callHandler(...argv);

    wrapper.action = this;
    wrapper.subscribe = (listener) => this.dispatcher.subscribe(this, listener);
    wrapper.unsubscribe = (listener) => this.dispatcher.unsubscribe(this, listener);

    return wrapper;
  }

  trigger(data) {
    this.dispatcher.trigger(this, data);
  }

  callHandler(...argv) {
    const res = (this.handler || noop)(...(this.prefill.concat(argv)));
    const promise = (res instanceof Promise) ? res : new Promise(resolve => resolve(res));

    promise
      .then((data) => this.trigger(data))
      .catch((data) => this.error.trigger(data));

    return promise;
  }

}

module.exports = Action;
