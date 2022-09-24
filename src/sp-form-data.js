import convertToArray from './helpers/convertToArray';
import serializeArray from './helpers/serializeArray';
import normalizeArray from './helpers/normalizeArray';
import { isEmptyObject } from './helpers/isEmpty';

export default class SPFormData {
    constructor(elements, params) {
        this.elements = convertToArray(elements);

        if (!this.elements.length) return;

        this.defaults = {
            delayBeforeSend: 600,
            autoSubmit: true,
            changeGetUrl: true,
            formSync: false
        };

        this.params = Object.assign(this.defaults, params);

        this.query = null;

        this.submitTimeout = true;

        this.init();
    }

    getUrlString(params, keys = [], isArray = false) {
        const p = Object.keys(params)
            .map((key) => {
                const val = params[key];

                if (Object.prototype.toString.call(val) === '[object Object]' || Array.isArray(val)) {
                    if (Array.isArray(params)) {
                        keys.push('');
                    } else {
                        keys.push(key);
                    }
                    return this.getUrlString(val, keys, Array.isArray(val));
                }
                let tKey = key;

                if (keys.length > 0) {
                    const tKeys = isArray ? keys : [...keys, key];
                    tKey = tKeys.reduce((str, k) => {
                        return str === '' ? k : `${str}[${k}]`;
                    }, '');
                }
                if (isArray) {
                    return `${tKey}[]=${val}`;
                }
                return `${tKey}=${val}`;
            })
            .join('&');

        keys.pop();
        return p;
    }

    searchParams() {
        if (this.params.changeGetUrl) {
            const params = new URLSearchParams(window.location.search);
            const query = {};

            params.forEach((value, key) => {
                if (value !== '') {
                    if (value.indexOf(',') !== -1) {
                        query[key] = value.split(',');
                    } else {
                        query[key] = value;
                    }
                }
            });

            this.query = !isEmptyObject(query) ? query : null;
        }
        this.sendForm();
    }

    changeGetUrl(arr) {
        if (!isEmptyObject(arr)) {
            const url = `?${decodeURIComponent(this.getUrlString(arr))}`;
            window.history.pushState({}, '', url);

            this.searchParams();
        } else {
            this.resetForm();
        }
    }

    noChangeGetUrl(arr) {
        if (!isEmptyObject(arr)) {
            const query = {};

            Object.keys(arr).forEach((pair) => {
                if (arr[pair] !== '') {
                    if (arr[pair].indexOf(',') !== -1) {
                        query[pair] = arr[pair].split(',');
                    } else {
                        query[pair] = arr[pair];
                    }
                }
            });

            this.query = query;
            this.searchParams();
        } else {
            this.resetForm();
        }
    }

    activateForm(el) {
        if (this.params.formSync) {
            let result = {};
            el.forEach((formElement) => {
                const arrDataForm = serializeArray(formElement);
                if (arrDataForm.length) {
                    result = { ...result, ...normalizeArray(arrDataForm) };
                } else {
                    this.resetForm();
                }
            });

            if (this.params.changeGetUrl) {
                this.changeGetUrl(result);
            } else {
                this.noChangeGetUrl(result);
            }
        } else {
            const arrDataForm = serializeArray(el);
            if (arrDataForm.length) {
                const result = normalizeArray(arrDataForm);

                if (this.params.changeGetUrl) {
                    this.changeGetUrl(result);
                } else {
                    this.noChangeGetUrl(result);
                }
            } else {
                this.resetForm();
            }
        }
    }

    resetForm() {
        window.history.pushState({}, '', '.');

        this.query = null;
        this.sendForm();
    }

    sendForm() {
        if (this.params.response) {
            if (typeof this.params.response === 'function') {
                if (this.params && this.params.response) {
                    this.params.response(this.query);
                }
            } else {
                throw new Error('SPFormData#response must be passed a plain function');
            }
        }

        let event;
        if (window.CustomEvent && typeof window.CustomEvent === 'function') {
            event = new CustomEvent('spFormDataResponse', { detail: { query: this.query } });
        } else {
            event = document.createEvent('CustomEvent');
            event.initCustomEvent('spFormDataResponse', true, true, { query: this.query });
        }

        this.elements.forEach((formElement) => {
            formElement.dispatchEvent(event);
        });
    }

    response(data) {
        this.elements.forEach((formElement) => {
            formElement.addEventListener('spFormDataResponse', (event) => {
                data(event.detail.query);
            });
        });

        if (window.location.search !== '') {
            data(this.query);
        }
    }

    init() {
        this.elements.forEach((formElement) => {
            const activateFormElement = this.params.formSync ? this.elements : formElement;

            if (formElement.tagName === 'FORM') {
                formElement.addEventListener('submit', (e) => {
                    e.preventDefault();

                    if (!this.params.autoSubmit) {
                        this.activateForm(activateFormElement);
                    }
                });

                if (this.params.autoSubmit) {
                    formElement.querySelectorAll('select, input, textarea').forEach((element) => {
                        element.addEventListener('change', () => {
                            if (this.submitTimeout) clearTimeout(this.submitTimeout);
                            this.submitTimeout = setTimeout(() => {
                                this.activateForm(activateFormElement);
                            }, this.params.delayBeforeSend);
                        });
                    });
                }
            } else {
                throw new Error('SPFormData constructor must be passed a form element');
            }
        });

        if (this.params.changeGetUrl) {
            window.addEventListener('popstate', () => {
                if (window.location.search !== '') {
                    this.searchParams();
                } else {
                    this.resetForm();
                }
            });

            if (window.location.search !== '') {
                this.searchParams();
            }
        }
    }
}