//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.
//
//     内容引用于：
//     hanzichi/underscore-analysis  地址： https://github.com/hanzichi/underscore-analysis/
//     undersercore 源码分析 地址：https://www.gitbook.com/book/yoyoyohamapi/undersercore-analysis/details
//     以及英文原文注释翻译


(function() {

    // Baseline setup
    // 基本设置、配置
    // --------------

    // Establish the root object, `window` in the browser, or `exports` on the server.
    // 将 this 赋值给局部变量 root
    // root 的值, 客户端为 `window`, 服务端(node) 中为 `exports`
    var root = this;

    // Save the previous value of the `_` variable.
    // 在全局变量中的_被占用的情况下，将root._先缓存下来，然后在noConflict函数中恢复
    // 如果没有被占用的话，那就是undefined
    var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    // 缓存变量, 便于压缩代码
    // 此处「压缩」指的是压缩到 min.js 版本
    // 而不是 gzip 压缩
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    // 缓存变量, 便于压缩代码
    // 同时可减少在原型链中的查找次数(提高代码效率)
    var
        push             = ArrayProto.push,
        slice            = ArrayProto.slice,
        toString         = ObjProto.toString,
        hasOwnProperty   = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    // ES5 原生方法, 如果浏览器支持, 则 underscore 中会优先使用
    var
        nativeIsArray      = Array.isArray,
        //Object.keys() 方法会返回一个由一个给定对象的自身可枚举属性组成的数组
        // 数组中属性名的排列顺序和使用 for...in 循环遍历该对象时返回的顺序一致
        // （两者的主要区别是 一个 for-in 循环还会枚举其原型链上的属性）
        nativeKeys         = Object.keys,
        nativeBind         = FuncProto.bind,
        nativeCreate       = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    //空函数，在baseCreate中有用到
    var Ctor = function(){};

    // Create a safe reference to the Underscore object for use below.
    // 核心函数
    // `_` 其实是一个构造函数
    // 支持无 new 调用的构造函数（思考 jQuery 的无 new 调用）
    // 将传入的参数（实际要操作的数据）赋值给 this._wrapped 属性
    // each 等方法都在该构造函数的原型链上
    // _([1, 2, 3]).each(alert)
    // _([1, 2, 3]) 相当于无 new 构造了一个新的对象
    // 调用了该对象的 each 方法，该方法在该对象构造函数的原型链上
    var _ = function(obj) {

        // 使用new调用时，new _(obj)this指向新创建的对象。obj instanceof _ => true,直接返回这个对象
        if (obj instanceof _)
            return obj;

        // 如果不用new调用而直接调用，比如，_({1,2,3}),那么this指向全局作用域（root）,this instanceof _ => false;
        // 如果是直接调用的情况下，直接new一个新的obj返回，注意也调用了_这个构造函数，所以还是会重新调用一次这个函数
        if (!(this instanceof _))
            return new _(obj);



        // 不是new调用的情况下，将 obj 赋值给 this._wrapped 属性
        // _wrapped记录了obj
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `_` as a global object.
    // 将上面定义的 `_` 局部变量赋值给全局对象中的 `_` 属性
    // 即客户端中 window._ = _
    // 服务端(node)中 exports._ = _
    // 同时在服务端向后兼容老的 require() API
    // 这样暴露给全局后便可以在全局环境中使用 `_` 变量(方法)
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            //node.js
            // 在默认情况下，module.exports 是一个Object， exports 是 module.exports 的一个引用。
            // 大多数人都是通过 exports.xx = yy 来输出。
            // 当模块要输出一个非Object时（比如一个Function），可以使用 module.exports = function () {} ，
            // 此时 module.exports 被覆盖了，而 exports 还是原来的对像的引用，为了避免在后面的代码中仍然使用 exports.xx = yy
            // 而导致不能正确输出，需要把 exports 变量也重新设置为新的 module.exports 的引用，
            // 所以一般习惯写成 exports = module.exports = xxx
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        root._ = _;
    }

    // Current version.
    // 当前 underscore 版本号
    _.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    // underscore 内部方法
    // 根据 this 指向（context 参数）
    // 以及 argCount 参数
    // 二次操作返回一些回调、迭代方法
    //这个函数的作用是，将func的this指向context。
    //也就是将this绑定到参数context上。
    //这个函数根据argCount大小，也就是参数的个数，返回的是绑定了context的不同参数个数的函数
    var optimizeCb = function(func, context, argCount) {
        // 如果没有指定 this 指向，则返回原函数
        if (context === void 0)
            return func;
        switch (argCount == null ? 3 : argCount) {
            //case 1，参数只有一个（就是value）
            case 1: return function(value) {
                return func.call(context, value);
            };
            //case 2，参数有两个
            case 2: return function(value, other) {
                return func.call(context, value, other);
            };

            // 如果有指定 this，但没有传入 argCount 参数
            // 则执行以下 case
            // _.each、_.map，predicate = cb(predicate（function）, context);
            case 3: return function(value, index, collection) {
                return func.call(context, value, index, collection);
            };
            // _.reduce、_.reduceRight
            //有四个参数
            case 4: return function(accumulator, value, index, collection) {
                return func.call(context, accumulator, value, index, collection);
            };
        }

        // 其实不用上面的 switch-case 语句
        // 直接执行下面的 return 函数就行了
        // 不这样做的原因是 call 比 apply 快很多
        // .apply 在运行前要对作为参数的数组进行一系列检验和深拷贝，.call 则没有这些步骤
        // 具体可以参考：
        // https://segmentfault.com/q/1010000007894513
        // http://www.ecma-international.org/ecma-262/5.1/#sec-15.3.4.3
        // http://www.ecma-international.org/ecma-262/5.1/#sec-15.3.4.4
        return function() {
            return func.apply(context, arguments);
        };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    //
    var cb = function(value, context, argCount) {
        //如果value==null，怎返回一个函数，这个函数输入什么输出什么
        if (value == null) return _.identity;
        //如果是value是函数的话，则返回绑定了context的value函数
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        // _.isObject这里的对象包括 function 和 object,并且不是空对象
        //由于写在了_.isFunction(value)后面，所以只有object的情况才可以执行_.matcher(value)
        //_.matcher(attrs)返回一个函数，需要进一步传入object，才能返回布尔值，判断attrs是否全在object中
        if (_.isObject(value)) return _.matcher(value);
        //_.property(key)返回一个函数，这个函数返回任何传入的对象的key的value。
        return _.property(value);
    };

    //_.iteratee(value, [context])是一个内部函数用来生成可应用到集合中每个元素的回调， 返回想要的结果 。
    // 无论是等式，任意回调，属性匹配，或属性访问。
    //通过_.iteratee转换判断的Underscore 方法的完整列表是
    // map, find, filter, reject, every, some, max, min, sortBy, groupBy, indexBy, countBy, sortedIndex, partition, 和 unique.
    //举例说明：
    // var stooges = [{name: 'curly', age: 25}, {name: 'moe', age: 21}, {name: 'larry', age: 23}];
    // _.map(stooges, _.iteratee('age'));
    // => [25, 21, 23];参数value是object，reutrn _.matcher(value);
    _.iteratee = function(value, context) {
        return cb(value, context, Infinity);
    };

    // An internal function for creating assigner functions.
    // 这个函数是用来将具有对象间复制操作的函数传递出去（闭包）
    // 有三个方法用到了这个内部函数
    // _.extend & _.extendOwn & _.defaults
    // _.extend = createAssigner(_.allKeys);
    // _.extendOwn = _.assign = createAssigner(_.keys);
    // _.defaults = createAssigner(_.allKeys, true);
    //例子：
    //_.extend({name: 'moe'}, {age: 50});
    // => {name: 'moe', age: 50}
    var createAssigner = function(keysFunc, undefinedOnly) {
        // 返回函数
        // 经典闭包（undefinedOnly 参数在返回的函数中被引用）
        // 将第二个开始的对象参数的键值对复制给第一个参数
        return function(obj) {
            //arguments是嵌套在里面的函数的参数列表，arguments里装的是对象
            var length = arguments.length;
            // 只传入了一个参数（或者 0 个？）由于是进行复制操作，所以参数个数>=2
            // 这个函数无法将一个对象的属性复制给一个空对象，对空对象的复制操作始终返回一个空对象
            if (length < 2 || obj == null) return obj;

            // 枚举第一个参数除外的对象参数
            // 即 arguments[1], arguments[2] ...
            for (var index = 1; index < length; index++) {
                // source 是一个对象
                var source = arguments[index],
                    // 提取这个对象参数的 keys 值
                    // keysFunc 参数表示 _.key 或者 _.allKeys
                    //keys是这个对象的键集合
                    keys = keysFunc(source),
                    l = keys.length;
                // 遍历该对象的键值对
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    // _.extend 和 _.extendOwn 方法
                    // 没有传入 undefinedOnly 参数，即 !undefinedOnly 为 true
                    // 即肯定会执行 obj[key] = source[key]
                    // 后面对象的键值对直接覆盖 obj
                    // ==========================================
                    // _.defaults 方法，undefinedOnly 参数为 true
                    // 即 !undefinedOnly 为 false
                    // 那么当且仅当 obj[key] 为 undefined 时才覆盖
                    // 即如果有相同的 key 值，取最早出现的 value 值
                    // *defaults 中有相同 key 的也是一样取首次出现的
                    if (!undefinedOnly || obj[key] === void 0)
                        obj[key] = source[key];
                }
            }

            // 返回已经复制后面对象参数属性的第一个参数对象
            return obj;
        };
    };

    // An internal function for creating a new object that inherits from another.
    // use in `_.create`
    //_.create(prototype, props)
    // 创建具有给定原型的新对象， 可选附加props 作为 own的属性。 基本上，和Object.create一样， 但是没有所有的属性描述符。
    // var moe = _.create(Stooge.prototype, {name: "Moe"});
    var baseCreate = function(prototype) {
        // 如果 prototype 参数不是对象
        if (!_.isObject(prototype)) return {};

        // 如果浏览器支持 ES5 Object.create
        //Object.create(prototype, descriptors) 返回原型为prototype的，具有description属性的对象
        if (nativeCreate) return nativeCreate(prototype);
        //Ctor是个空函数
        //var Ctor = function(){};
        Ctor.prototype = prototype;
        //创建一个原型是prototype的新对象result
        var result = new Ctor;
        //将Ctor的原型重新置为null，留给下次调用
        Ctor.prototype = null;
        return result;
    };

    // 闭包
    // _.property(key)返回一个函数，这个函数返回任何传入的对象的key属性。
    //var stooge = {name: 'moe'};
    // 'moe' === _.property('name')(stooge);
    // => true
    var property = function(key){
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094

    // Math.pow(2, 53) - 1 是 JavaScript 中能精确表示的最大数字
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

    // getLength 函数
    // 该函数传入一个参数，返回参数的 length 属性值
    // 用来获取 array 以及 arrayLike 元素的 length 属性值
    //property('length')返回一个能够返回传入对象的长度属性的函数，并把它赋给getLength
    var getLength = property('length');

    // 判断是否是 ArrayLike Object
    // 类数组，即拥有 length 属性并且 length 属性值为 Number 类型的元素
    // 包括数组、arguments、HTML Collection 以及 NodeList 等等
    // 包括类似 {length: 10} 这样的对象
    // 包括字符串、函数等
    var isArrayLike = function(collection) {
        // 返回参数 collection 的 length 属性值
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };


    // Collection Functions
    // 数组或者对象的扩展方法
    // 共 25 个扩展方法
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    // 与 ES5 中 Array.prototype.forEach 使用方法类似
    // 遍历数组或者对象的每个元素
    // 第一个参数为数组（包括类数组）或者对象
    // 第二个参数为迭代方法，对数组或者对象每个元素都执行该方法
    // 该方法又能传入三个参数，分别为 (item, index, array)（(value, key, obj) for object）
    // 与 ES5 中 Array.prototype.forEach 方法传参格式一致
    // 第三个参数（可省略）确定第二个参数 iteratee 函数中的（可能有的）this 指向
    // 即 iteratee 中出现的（如果有）所有 this 都指向 context
    // notice: 要避免传递带有一个数值类型 length 属性的对象
    // notice: _.each 方法不能用 return 跳出循环（同样，Array.prototype.forEach 也不行），因为使用for循环，一定会遍历一遍所有元素。

    //遍历list中的所有元素，按顺序用每个元素当做参数调用 iteratee 函数。
    // 如果传递了context参数，则把iteratee绑定到context对象上。
    //each是否改变原函数，要看iteratee怎么实现
    _.each = _.forEach = function(obj, iteratee, context) {

        // 根据 context 确定不同的迭代函数
        // 此处：iteratee= function(value, index, collection) {
        //     return iteratee.call(context, value, index, collection);
        // };
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        //普通的对象没有length属性，除非人为地给对象去定义
        //这里默认没有人为定义对象额length属性，所以可以通过isArrayList来判断是否是对象。
        // 如果是类数组
        // 默认不会传入类似 {length: 10} 这样的数据
        if (isArrayLike(obj)) {
            // 通过isArrayLike来判断为类数组
            for (i = 0, length = obj.length; i < length; i++) {
                //相当于iteratee.call(context,obj[i], i, obj);
                iteratee(obj[i], i, obj);
            }
        } else { // 如果 obj 是对象
            // 获取对象的所有 key 值
            //_.each({one: 1, two: 2, three: 3}, alert);
        // => alerts each number value in turn...
            var keys = _.keys(obj);
            // 如果是对象，则遍历处理 values 值
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj); // (value, key, obj)
            }
        }
        // 返回 obj 参数
        // 供链式调用（Returns the list for chaining）
        // 应该仅 OOP 调用有效
        return obj;
    };

    // Return the results of applying the iteratee to each element.
    // 与 ES5 中 Array.prototype.map 使用方法类似
    // 传参形式与 _.each 方法类似
    // 遍历数组（每个元素）或者对象的每个元素（value）
    // 对每个元素执行 iteratee 迭代方法
    // 将结果保存到新的数组中，并返回
    //map和each的区别在于map要生成新数组返回，each不用
    _.map = _.collect = function(obj, iteratee, context) {
        // 根据 context 确定不同的迭代函数
        //与_.each 方法类似
        iteratee = cb(iteratee, context);

        // 如果传参是对象，则获取它的 keys 值数组（短路表达式).
        // 否则返回false。
        // 根据keys是否为false来确定obj是否是对象，如果keys为false那么obj就为数组
        var keys = !isArrayLike(obj) && _.keys(obj),
            // 如果 obj 为对象，则 length 为 key.length
            // 如果 obj 为数组，则keys为空，则 length 为 obj.length
            length = (keys || obj).length,
            results = Array(length); // 结果数组

        // 遍历
        for (var index = 0; index < length; index++) {
            // 如果 obj 为对象，则 currentKey 为对象键值 key
            // 如果 obj 为数组，则 currentKey 为 index 值
            var currentKey = keys ? keys[index] : index;
            //从这里看出，iteratee应该有返回值，参数格式如下：
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }

        // 返回新的结果数组
        return results;
    };

    // Create a reducing function iterating left or right.
    // dir === 1 -> _.reduce=createReduce(1)
    //var sum = _.reduce([1, 2, 3], function(memo, num，index，obj){ return memo + num; }, 0);
    // => 6
    // dir === -1 -> _.reduceRight=createReduce(-1)
    // var list = [[0, 1], [2, 3], [4, 5]];
    // var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
    // => [4, 5, 2, 3, 0, 1]
    function createReduce(dir) {
        // Optimized iterator function as using arguments.length
        // in the main function will deoptimize the, see #1991.
        // console.log(memo)
        //定义iterator函数给后面调用
        //return iterator(obj, iteratee, memo, keys, index, length);
        function iterator(obj, iteratee, memo, keys, index, length) {
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                // 迭代，返回值供下次迭代调用
                // iteratee = function(accumulator, value, index, collection) {
                //     return func.call(context, accumulator, value, index, collection);
                // };
                //随着迭代次数，更新memo
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            // 每次迭代返回值，供下次迭代调用
            return memo;
        }
        // _.reduce（_.reduceRight）可传入的 4 个参数
        // obj 数组或者对象
        // iteratee 迭代方法，对数组或者对象每个元素执行该方法
        // memo 初始值，如果没有则从 obj 第二个元素开始迭代，将第一个元素作为初始值
        // context 为迭代函数中的 this 指向
        return function(obj, iteratee, memo, context) {

            iteratee = optimizeCb(iteratee, context, 4);

            //此处与map方法相同，如果是对象那么keys为对象的键的数组
            //如果是数组，keys为false
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            // Determine the initial value if none is provided.
            // 如果没有指定初始值（arguments.length < 3）
            // 则把第一个元素指定为初始值
            if (arguments.length < 3) {
                memo = obj[keys ? keys[index] : index];
                // 根据 dir 确定是向左还是向右遍历
                index += dir;
            }
            //这里调用iterator函数，确定了memo,keys和index，length
            return iterator(obj, iteratee, memo, keys, index, length);
        };
    }

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    // 与 ES5 中 Array.prototype.reduce 使用方法类似
    // _.reduce(list, iteratee, [memo], [context])
    // _.reduce 方法最多可传入 4 个参数
    // memo 为初始值，可选
    // context 为指定 iteratee 中 this 指向，可选
    _.reduce = _.foldl = _.inject = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    // 与 ES5 中 Array.prototype.reduceRight 使用方法类似
    _.reduceRight = _.foldr = createReduce(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    // 寻找数组或者对象中第一个满足条件（predicate 函数返回 true）的元素
    // 并返回该元素值
    // 如果没有元素通过检测则返回 undefined。
    // 如果找到匹配的元素，函数将立即返回，不会遍历整个list。
    // _.find(list, predicate, [context])
    //var even = _.find([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
    // => 2
    _.find = _.detect = function(obj, predicate, context) {
        var key;
        // 如果 obj 是数组，key 为满足条件的下标
        if (isArrayLike(obj)) {
            //_.findIndex默认是数组的方法，判断obj为数组时调用。
            //不存在返回-1
            key = _.findIndex(obj, predicate, context);
        } else {
            // 如果 obj 是对象，key 为满足条件的元素的 key 值
            //不存在返回undefined
            key = _.findKey(obj, predicate, context);
        }
        //void 0总是返回undefined
        // 如果该元素存在（不是undefined），并且不是-1，则返回该元素
        // 如果不存在，则默认返回 undefined（函数没有返回，即返回 undefined）
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    // 与 ES5 中 Array.prototype.filter 使用方法类似
    // 寻找数组或者对象中所有满足条件的元素
    // 如果是数组，则将 `元素值` 存入数组
    // 如果是对象，则将 `value 值` 存入数组
    // 返回该数组
    // _.filter(list, predicate, [context])
    //遍历list中的每个值，返回所有通过predicate真值检测的元素所组成的数组。
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];

        // 将predicate函数的this绑定到context上
        predicate = cb(predicate, context);

        // 遍历每个元素，如果符合条件则存入数组
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });

        return results;
    };

    // Return all the elements for which a truth test fails.
    // 寻找数组或者对象中所有不满足条件的元素
    // 并以数组方式返回
    // 所得结果是 _.filter 方法的补集
    _.reject = function(obj, predicate, context) {
        //cb(predicate)=>return predicate
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    // 与 ES5 中的 Array.prototype.every 方法类似
    // 判断数组中的每个元素或者对象中每个 value 值是否全都满足 predicate 函数中的判断条件
    // 如果是，则返回 ture；否则返回 false（有一个不满足就返回 false）
    // _.every(list, [predicate], [context])
    _.every = _.all = function(obj, predicate, context) {
        // 绑定predicate的this指向context，如果没有this默认指向构造函数"_"
        predicate = cb(predicate, context);

        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;

        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            // 如果有一个不能满足 predicate 中的条件
            // 则返回 false
            if (!predicate(obj[currentKey], currentKey, obj))
                return false;
        }

        return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    // 与 ES5 中 Array.prototype.some 方法类似
    // 判断数组或者对象中是否有一个元素（value 值 for object）满足 predicate 函数中的条件
    // 如果是则返回 true；否则返回 false
    // _.some(list, [predicate], [context])
    _.some = _.any = function(obj, predicate, context) {
        // 绑定predicate的this指向context，如果没有this默认指向构造函数"_"
        predicate = cb(predicate, context);
        // 如果传参是对象，则返回该对象的 keys 数组
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            // 如果有一个元素满足条件，则返回 true
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    // 如果list包含指定的value则返回true（使用===检测）
    // 如果list 是数组，内部使用indexOf判断。使用fromIndex来给定开始检索的索引位置。
    // 如果是 object，则忽略 key 值，只需要查找 value 值即可
    // 即该 obj 中是否有指定的 value 值
    // 返回布尔值
    // _.contains([1, 2, 3], 3);=>true
    _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
        // 如果是对象，返回 values 组成的数组
        if (!isArrayLike(obj)) obj = _.values(obj);

        // fromIndex 表示查询起始位置
        // 如果fromIndex不是number类型（没有指定该参数），则默认从头找起
        //如果fromIndex是number类型，但是定义了guard，fromIndex也为0。
        //这里的guard应该是用来确保从0开始遍历
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;

        // _.indexOf 是数组的扩展方法（Array Functions）
        // 数组中寻找某一元素
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    // Calls the method named by methodName on each value in the list.
    // Any extra arguments passed to invoke will be forwarded on to the method invocation.
    // 数组或者对象中的每个元素都调用 method 方法
    // 返回调用后的结果（数组或者关联数组）
    // method 参数后的参数会被当做参数传入 method 方法中
    // _.invoke(list, method, *arguments)
    // _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
    // => [[1, 5, 7], [1, 2, 3]]
    //_.invoke([[5, 1, 7], [3, 2, 1]], Array.prototype.join);
    //=>["5,1,7", "3,2,1"]
    //_.invoke和_.map比较：_.invoke是能够向method传递参数，_.map中的函数的参数是固定好了的=>_.invoke可以调用更多的函数
    _.invoke = function(obj, method) {
        // *arguments 参数
        // slice  =  Array.prototype.slice()
        var args = slice.call(arguments, 2);
        // 判断 method 是不是函数,method可以是函数，也可以是内置函数名的字符串（比如'sort')
        //可以用obj['函数名'](参数)调用这个函数
        //console.log([5, 1, 7]['sort']([5,1,7]));
        var isFunc = _.isFunction(method);

        // 用 map 方法对数组或者对象每个元素调用方法,并返回一个新数组
        //function(value)要求有返回值,可以自定义函数
        return _.map(obj, function(value) {
            var func = isFunc ? method : value[method];
            return func == null ? func : func.apply(value, args);
        });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    // 一个对象数组
    // 根据指定的 key 值
    // 返回一个数组，元素都是指定 key 值的 value 值
    /*
     var property = function(key) {
     return function(obj) {
     return obj == null ? void 0 : obj[key];
     };
     };
     */
    // _.pluck(list, propertyName)
    // var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    // _.pluck(stooges, 'name');
    // => ["moe", "larry", "curly"]
    //pluck是map最常使用的用例模型的简化版本，即提取数组对象中某属性值，返回一个数组
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    // obj 是一个对象数组，在这个对象数组中将含有attrs所有键值对的对象存进数组里返回
    // _.where(listOfPlays, {author: "Shakespeare", year: 1611});
    // => [{title: "Cymbeline", author: "Shakespeare", year: 1611},
    //     {title: "The Tempest", author: "Shakespeare", year: 1611}]
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    // obj是对象数组，在这个数组种寻找第一个有指定 key-value 键值对的对象
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    // 寻找数组中的最大元素
    // 或者对象中的最大 value 值
    // 如果有 iteratee 参数，则求每个元素经过该函数迭代后的最值
    // _.max(list, [iteratee], [context])
    //     var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    //     _.max(stooges, function(stooge){ return stooge.age; });
    // => {name: 'curly', age: 60};
    _.max = function(obj, iteratee, context) {
        var result = -Infinity, lastComputed = -Infinity,
            value, computed;
        // result 保存结果元素
        // 单纯地寻找最值
        if (iteratee == null && obj != null) {
            // 如果是数组，则寻找数组中最大元素
            // 如果是对象，则寻找最大 value 值
            obj = isArrayLike(obj) ? obj : _.values(obj);

            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value > result) {
                    result = value;
                }

                // if(obj[i] > result) {
                //   result = obj[i];         ???? 为什么要多设一个value参数？
                // }
            }
        } else {  // 寻找元素经过迭代后的最值
            iteratee = cb(iteratee, context);
            // lastComputed 保存计算过程中出现的最值
            // 遍历元素
            _.each(obj, function(value, index, list) {
                // 经过迭代函数后的值
                computed = iteratee(value, index, list);
                // && 的优先级高于 ||
                //if (computed > lastComputed ||(computed === -Infinity && result === -Infinity))
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = value;
                    lastComputed = computed;
                }
            });
        }

        return result;
    };

    // Return the minimum element (or element-based computation).
    // 寻找最小的元素
    // 类似 _.max
    // _.min(list, [iteratee], [context])
    _.min = function(obj, iteratee, context) {
        var result = Infinity, lastComputed = Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index, list) {
                computed = iteratee(value, index, list);
                if (computed < lastComputed || computed === Infinity && result === Infinity) {
                    result = value;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Shuffle a collection, using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    // 将数组乱序
    // 如果是对象，则返回一个数组，数组由对象 value 值构成
    // Fisher-Yates shuffle 算法
    // 最优的洗牌算法，复杂度 O(n)
    // 乱序不要用 sort + Math.random()，复杂度 O(nlogn)
    // 而且，并不是真正的乱序
    // @see https://github.com/hanzichi/underscore-analysis/issues/15
    //算法的思想就是遍历原数组，把原数组中位置 index 的数据随机放到新数组的前rand个位置（包括第index个）中的某一个（假设放到第rand个），
    // 然后把新数组的第rand个位置的数放到新数组的第 index个位置
    _.shuffle = function(obj) {
        // 如果是对象，则对 value 值进行乱序，set是原数组
        var set = isArrayLike(obj) ? obj : _.values(obj);
        var length = set.length;

        // 乱序后返回的数组副本（参数是对象则返回乱序后的 value 数组）
        var shuffled = Array(length);

        // 枚举元素
        for (var index = 0, rand; index < length; index++) {
            // 将当前所枚举位置的元素和 `index=rand` 位置的元素交换
            //rand在[0,index]间
            rand = _.random(0, index);
            //如果rand!==index的话，就在新数组中交换，否则就不用交换
            if (rand !== index) shuffled[index] = shuffled[rand];

            shuffled[rand] = set[index];
        }
        //简单证明一下，对于新数组中的第i个位置，如果想要在这个位置放置某个数字，求这个数字被放在第i个位置的概率。
        //循环从前往后，后面放置的数字可以替换掉前面放置的数字
        //所以只需要保证，放置了那个数字后不被替换掉就可以了。
        //假设这个位置是i，放置那个数字到位置i的概率为1/i，后面的放置过程中要求不会选到位置i
        //所以有（1/i）*（i/i+1)*(i+1/i+2).....*(n-1/n)=1/n。
        //同理可证其他位置
        return shuffled;
    };

    // Sample **n** random values from a collection.
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    // 随机返回数组或者对象中的一个元素
    // 如果指定了参数 `n`，则随机返回 n 个元素组成的数组
    // 如果参数是对象，则数组由 values 组成
    _.sample = function(obj, n, guard) {
        // 随机返回一个元素
        if (n == null || guard) {
            if (!isArrayLike(obj)) obj = _.values(obj);
            return obj[_.random(obj.length - 1)];
        }

        // 随机返回前 n 个
        return _.shuffle(obj).slice(0, Math.max(0, n));
    };

    // Sort the object's values by a criterion produced by an iteratee.
    // 排序
    // 根据iteratee的返回值进行排序
    // _.sortBy(list, iteratee, [context])
    // _.sortBy([1, 2, 3, 4, 5, 6], function(num){ return Math.sin(num); });
    // => [5, 4, 6, 3, 1, 2]
    // var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    // _.sortBy(stooges, 'name');
    // => [{name: 'curly', age: 60}, {name: 'larry', age: 50}, {name: 'moe', age: 40}];
    _.sortBy = function(obj, iteratee, context) {
        //iteratee根据传入参数的类型，返回不一样的函数
        //如果iteratee不是函数的话，iteratee被替换为
        // ƒ (obj) {
        //     return obj == null ? void 0 : obj[key];
        // }
        iteratee = cb(iteratee, context);
        // 根据指定的 key 返回 values 数组
        // _.pluck([{}, {}, {}], 'value')
        return _.pluck(
            // _.map(obj, function(){}).sort()
            // _.map 后的结果 [{}, {}..]
            // sort 后的结果 [{}, {}..]
            // list 是原数组
            _.map(obj, function(value, index, list) {
                //return一个对象
                //value是整个对象，或者是数组的数
                return {
                    value: value,
                    index: index,
                    // 元素经过迭代函数迭代后的值，也可能是对象的value
                    criteria: iteratee(value, index, list)

                };
            }).sort(function(left, right) {
                var a = left.criteria;
                var b = right.criteria;
                if (a !== b) {
                    //return >0 ,说明需要交换
                    if (a > b || a === void 0) return 1;
                    if (a < b || b === void 0) return -1;
                }
                //相等的情况下，保持原来的顺序
                return left.index - right.index;
            }), 'value');

    };

    // An internal function used for aggregate "group by" operations.
    // behavior 是一个函数参数
    // _.groupBy, _.indexBy 以及 _.countBy 其实都是对数组元素进行分类
    // 分类规则就是 behavior 函数
    var group = function(behavior) {
        return function(obj, iteratee, context) {
            // 返回结果是一个对象，以key为下标
            var result = {};
            //这里的iteratee也有两种函数的可能
            iteratee = cb(iteratee, context);
            // 遍历元素
            _.each(obj, function(value, index) {
                // 经过迭代，获取结果值，存为 key
                var key = iteratee(value, index, obj);
                // 按照不同的规则进行分组操作
                // 将变量 result数组 当做参数传入，能在 behavior 中改变该值
                behavior(result, value, key);
            });
            // 返回结果对象
            return result;
        };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    // groupBy_  _.groupBy(list, iteratee, [context])
    // 根据特定规则对数组或者对象中的元素进行分组
    // result 是返回对象
    // value 是数组元素
    // key 是迭代后的值
    // _.groupBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
    // => {1: [1.3], 2: [2.1, 2.4]}
    _.groupBy = group(function(result, value, key) {
        // 根据 key 值分组
        // key 是元素经过迭代函数后的值
        // 或者元素自身的属性值

        // result 对象已经有该 key 值了，没有的话就在result中新建一个key值
        if (_.has(result, key))
            result[key].push(value);//在对象中push value
        else result[key] = [value];

        // console.log(typeof [value]); => object，是个对象，具有length属性
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _.indexBy = group(function(result, value, key) {
        // key 值必须是独一无二的
        // 不然后面的会覆盖前面的
        // 其他和 _.groupBy 类似
        result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = group(function(result, value, key) {
        // 不同 key 值元素数量
        if (_.has(result, key))
            result[key]++;
        else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    // 伪数组 -> 数组
    // 对象 -> 提取 value 值组成数组
    // 返回数组
    _.toArray = function(obj) {
        if (!obj) return [];

        // 如果是数组，则返回副本数组
        // 是否用 obj.concat() 更方便？
        if (_.isArray(obj)){
            return slice.call(obj);
        }

        // 如果是类数组，则重新构造新的数组
        // 是否也可以直接用 slice 方法？
        //（应该可以）
        //_.map就是通过循环把obj的值存进数组里返回
        if (isArrayLike(obj)){
            return _.map(obj, _.identity);
        }

        // 如果是对象，则返回 values 集合。也是通过循环将values存进数组里
        return _.values(obj);
    };

    // Return the number of elements in an object.
    // 如果是数组（类数组），返回长度（length 属性）
    // 如果是对象，返回键值对数量
    _.size = function(obj) {
        if (obj == null) return 0;
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    // 将数组或者对象中符合条件（predicate）的元素
    // 和不符合条件的元素（数组为元素，对象为 value 值）
    // 分别放入两个数组中
    // 返回一个数组，数组元素为以上两个数组（[[pass array], [fail array]]）
    //_.partition([0, 1, 2, 3, 4, 5], isOdd);
    // => [[1, 3, 5], [0, 2, 4]]
    _.partition = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var pass = [], fail = [];
        _.each(obj, function(value, key, obj) {
            (predicate(value, key, obj) ? pass : fail).push(value);
        });
        return [pass, fail];
    };


    // Array Functions
    // 数组的扩展方法
    // 共 20 个扩展方法
    // Note: All array functions will also work on the arguments object.
    // However, Underscore functions are not designed to work on "sparse" arrays.
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    // 返回数组第一个元素
    // 如果有参数 n，则返回数组前 n 个元素（组成的数组）
    _.first = _.head = _.take = function(array, n, guard) {
        // 容错，数组为空则返回 undefined
        if (array == null) return void 0;

        // 没指定参数 n，则默认返回第一个元素
        if (n == null || guard) return array[0];

        // 如果传入参数 n，则返回前 n 个元素组成的数组
        // 返回前 n 个元素，即剔除后 array.length - n 个元素
        return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    // 传入一个数组
    // 返回剔除最后一个元素之后的数组副本
    // 如果传入参数 n，则剔除最后 n 个元素
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    // 返回数组最后一个元素
    // 如果传入参数 n
    // 则返回该数组后 n 个元素组成的数组
    // 即剔除前 array.length - n 个元素
    _.last = function(array, n, guard) {
        // 容错
        if (array == null) return void 0;

        // 如果没有指定参数 n，则返回最后一个元素
        if (n == null || guard) return array[array.length - 1];

        // 如果传入参数 n，则返回后 n 个元素组成的数组
        // 即剔除前 array.length - n 个元素
        return _.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    // 传入一个数组
    // 返回剔除第一个元素后的数组副本
    // 如果传入参数 n，则剔除前 n 个元素
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    // 去掉数组中所有的假值
    // 返回数组副本
    // JavaScript 中的假值包括 false、null、undefined、''、NaN、0
    // 联想 PHP 中的 array_filter() 函数
    // _.identity = function(value) {
    //   return value;
    // };
    _.compact = function(array) {
        return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    // 递归调用数组，将数组展开
    // 即 [1, 2, [3, 4]] => [1, 2, 3, 4]
    // flatten(array, shallow, false)
    // flatten(arguments, true, true, 1)
    // flatten(arguments, true, true)
    // flatten(arguments, false, false, 1)
    // ===== //
    // input => Array 或者 arguments
    // shallow => 是否只展开一层
    // strict === true，表示不保留基本元素，strict===false 表示保留基本元素，通常和 shallow === true 配合使用
    // 表示只展开一层，但是不保存非数组元素（即无法展开的基础类型）
    // flatten([[1, 2], 3, 4], true, true) => [1, 2]
    // flatten([[1, 2], 3, 4], false, true) = > []
    // startIndex => 从 input 的第几项开始展开
    // ===== //
    // 可以看到，如果 strict 参数为 true，那么 shallow 也为 true
    // 也就是展开一层，同时把非数组过滤
    // [[1, 2], [3, 4], 5, 6] => [1, 2, 3, 4]
    var flatten = function(input, shallow, strict, startIndex) {
        // output 数组保存结果
        // 即 flatten 方法返回数据
        // idx 为 output 的累计数组下标
        var output = [], idx = 0;

        // 根据 startIndex 变量确定需要展开的起始位置
        for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
            var value = input[i];

            // 数组 或者 arguments(类数组)
            // isArrayLike指类数组，underscope.js中类数组的定义是length属性为number的obj，比如{length: 10}
            // isArray调用Array.isArray
            if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
                // flatten current level of array or arguments obje

                if (!shallow){
                    // shallow===false 表示需深度展开
                    // 这里使用了递归，对value重新调用flatten，得到完全展开的结果对value进行赋值
                    value = flatten(value, shallow, strict);
                }
                // 递归展开到最后一层（没有嵌套的数组了）
                // 或者 (shallow === true) => 只展开一层
                // value 值肯定是一个数组
                var j = 0, len = value.length;

                // 这一步貌似没有必要
                // 毕竟 JavaScript 的数组会自动扩充
                // 但是这样写，感觉比较好，对于元素的 push 过程有个比较清晰的认识
                output.length += len;

                // 将 value 数组的元素添加到 output 数组中
                // 递归到这步的时候会执行这个while循环，将value都写进output中
                while (j < len) {
                    output[idx++] = value[j++];
                }

            } else if (!strict) {
                // (!strict === true) => (strict === false)
                // 当value是基本类型不是数组和类数组，并且strict为false时，会跳到这个else if
                // 如果是深度展开，即 shallow 参数为 false
                // 而如果此时 strict 为 true，则不能跳到这个分支内部
                // 所以 shallow === false && strict === true
                // 调用 flatten 方法得到的结果永远是空数组 []
                output[idx++] = value;
            }
        }

        return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    // 将嵌套的数组展开
    // _.flatten([1, [2], [3, [[4]]]]);
    // => [1, 2, 3, 4];
    // ====== //
    // 如果参数 (shallow === true)，则仅展开一层
    // _.flatten([1, [2], [3, [[4]]]], true);
    // => [1, 2, 3, [[4]]];
    _.flatten = function(array, shallow) {
        // array => 需要展开的数组
        // shallow => 是否只展开一层
        // false 为 flatten 方法 strict 变量
        // strict === false，则可以在flatten中处理基本类型
        return flatten(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    // without_.without(array, *values)
    // Returns a copy of the array with all instances of the values removed.
    // ====== //
    // _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
    // => [2, 3, 4]
    // ===== //
    // 从数组中移除指定的元素
    // 返回移除后的数组副本
    _.without = function(array) {
        // slice.call(arguments, 1)
        // 将 arguments 转为数组（同时去掉第一个元素，即数组）
        // 之后便可以调用 _.difference 方法
        // slice.call(arguments,1)获得的是要去掉的元素
        return _.difference(array, slice.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    // 数组去重
    // 如果第二个参数 `isSorted` 为 true
    // 则说明事先已经知道数组有序
    // 程序会跑一个更快的算法（一次线性比较，元素和数组前一个元素比较即可）
    // 如果有第三个参数 iteratee，则对数组每个元素迭代
    // 对迭代之后的结果进行去重
    // 返回去重后的数组（array 的子数组）
    // PS: 暴露的 API 中没 context 参数
    // _.uniq(array, [isSorted], [iteratee])
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
        // 没有传入 isSorted 参数
        // 转为 _.unique(array, false, undefined, iteratee)
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }

        // 如果有迭代函数
        // 则根据 this 指向二次返回新的迭代函数
        if (iteratee != null)
            iteratee = cb(iteratee, context);

        // 结果数组，是 array 的子集
        var result = [];

        // 已经出现过的元素（或者经过迭代过的值）
        // 用来过滤重复值
        var seen = [];

        for (var i = 0, length = getLength(array); i < length; i++) {
            var value = array[i],
                // 如果指定了迭代函数
                // 则对数组每一个元素进行迭代
                // 迭代函数传入的三个参数通常是 value, index, array 形式
                computed = iteratee ? iteratee(value, i, array) : value;

            // 如果是有序数组，则当前元素只需跟上一个元素对比即可
            // 用 seen 变量保存上一个元素
            if (isSorted) {
                // 如果 i === 0，是第一个元素，则直接 push
                // 否则比较当前元素是否和前一个元素相等
                if (!i || seen !== computed) result.push(value);
                // seen 保存当前元素，供下一次对比
                seen = computed;
            } else if (iteratee) {
                // 如果 seen[] 中没有 computed 这个元素值
                if (!_.contains(seen, computed)) {
                    seen.push(computed);
                    result.push(value);
                }
            } else if (!_.contains(result, value)) {
                // 如果不用经过迭代函数计算，也就不用 seen[] 变量了
                result.push(value);
            }
        }

        return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    // union_.union(*arrays)
    // Computes the union of the passed-in arrays:
    // the list of unique items, in order, that are present in one or more of the arrays.
    // ========== //
    // _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
    // => [1, 2, 3, 101, 10]
    // ========== //
    // 将多个数组的元素集中到一个数组中
    // 并且去重，返回数组副本
    _.union = function() {
        // 首先用 flatten 方法将传入的数组展开成一个数组
        // 然后就可以愉快地调用 _.uniq 方法了
        // 假设 _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
        // arguments 为 [[1, 2, 3], [101, 2, 1, 10], [2, 1]]
        // shallow 参数为 true，展开一层
        // 结果为 [1, 2, 3, 101, 2, 1, 10, 2, 1]
        // 然后对其去重
        return _.uniq(flatten(arguments, true, true));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    // 寻找几个数组中共有的元素
    // 将这些每个数组中都有的元素存入另一个数组中返回
    // _.intersection(*arrays)
    // _.intersection([1, 2, 3, 1], [101, 2, 1, 10, 1], [2, 1, 1])
    // => [1, 2]
    // 注意：返回的结果数组是去重的
    _.intersection = function(array) {
        // 结果数组
        var result = [];

        // 传入的参数（数组）个数
        var argsLength = arguments.length;

        // 遍历第一个数组的元素
        for (var i = 0, length = getLength(array); i < length; i++) {
            var item = array[i];

            // 如果 result[] 中已经有 item 元素了，continue
            // 即 array 中出现了相同的元素
            // 返回的 result[] 其实是个 "集合"（是去重的）
            if (_.contains(result, item)) continue;

            // 判断其他参数数组中是否都有 item 这个元素
            for (var j = 1; j < argsLength; j++) {
                if (!_.contains(arguments[j], item))
                    break;
            }

            // 遍历其他参数数组完毕
            // j === argsLength 说明其他参数数组中都有 item 元素
            // 则将其放入 result[] 中
            if (j === argsLength)
                result.push(item);
        }

        return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    // _.difference(array, *others)
    // Similar to without, but returns the values from array that are not present in the other arrays.
    // ===== //
    // _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
    // => [1, 3, 4]
    // ===== //
    // 剔除 array 数组中在 arguments 数组中出现的元素
    //_.difference(array, *others)
    _.difference = function(array) {
        // 不可以这样用 _.difference([1, 2, 3, 4, 5], [5, 2], 10);
        // 10 就会取不到，默认只有前两个参数有用
        // var flatten = function(input, shallow, strict, startIndex)
        // shallow===true =>只展开一层 ,strict===true 在这里没什么用貌似（？）
        // startIndex===1 =>只展开others数组
        // 将arguments全部传入flatten
        var rest = flatten(arguments, true, true, 1);
        // 遍历 array，过滤
        return _.filter(array, function(value){
            // 如果 value 存在在 rest 中，则过滤掉
            return !_.contains(rest, value);
        });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    // ===== //
    // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
    // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
    // ===== //
    // 将多个数组中相同位置的元素归类
    // 返回一个数组
    // _.zip 和 _.unzip的用处好像差不多，好像只有参数的形式不同？
    // _.zip的参数是多个数组，返回一个数组。
    // _.unzip的参数是一个数组，返回一个数组
    _.zip = function() {
        return _.unzip(arguments);
    };

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    // The opposite of zip. Given an array of arrays,
    // returns a series of new arrays,
    // the first of which contains all of the first elements in the input arrays,
    // the second of which contains all of the second elements, and so on.
    // ===== //
    // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
    // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
    // ===== //
    _.unzip = function(array) {
        var length = array && _.max(array, getLength).length || 0;
        var result = Array(length);

        for (var index = 0; index < length; index++) {
            result[index] = _.pluck(array, index);
        }
        return result;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    // 将数组转化为对象
    // 将数组转换为对象。传递任何一个单独[key, value]对的列表，或者一个键的列表和一个值得列表。
    // 如果存在重复键，最后一个值将被返回。
    // _.object(['moe', 'larry', 'curly'], [30, 40, 50]);
    // => {moe: 30, larry: 40, curly: 50}
    //
    // _.object([['moe', 30], ['larry', 40], ['curly', 50]]);
    // => {moe: 30, larry: 40, curly: 50}
    _.object = function(list, values) {

        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            //根据参数的个数，来判断操作
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    // (dir === 1) => 从前往后找
    // (dir === -1) => 从后往前找
    function createPredicateIndexFinder(dir) {
        // 经典闭包
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);

            // 根据 dir 变量来确定数组遍历的起始位置
            var index = dir > 0 ? 0 : length - 1;

            for (; index >= 0 && index < length; index += dir) {
                // 找到第一个符合条件的元素
                // 并返回下标值
                //这里的array默认是数组，不是对象
                if (predicate(array[index], index, array))

                    return index;
            }

            return -1;
        };
    }


    // Returns the first index on an array-like that passes a predicate test
    // 从前往后找到数组中 predicate函数return true 的元素，并返回下标值
    // 没找到返回 -1
    // _.findIndex(array, predicate, [context])
    _.findIndex = createPredicateIndexFinder(1);

    // 从后往前找到数组中 predicate函数return true 的元素，并返回下标值
    // 没找到返回 -1
    // _.findLastIndex(array, predicate, [context])
    _.findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    // The iteratee may also be the string name of the property to sort by (eg. length).
    //iteratee可以是函数，如果他是函数，那么iteratee将作为list排序的依据。

    //iteratee也可以是字符串的属性名，并根据这个属性来排序(比如length)。
    //比如：
    // var stooges = [{name: 'moe', age: 40}, {name: 'curly', age: 60}];
    // _.sortedIndex(stooges, {name: 'larry', age: 50}, 'age');
    // => 1
    // _.sortedIndex([10, 20, 30, 40, 50], 35);
    // => 3
    //_.sortedIndex(list, value, [iteratee], [context]) 这个函数的作用是将value插入list中相应位置，相应位置根据iteratee得到
    //查找过程中使用了二分查找，二分查找成立的前提，要求list有序。返回该插入的位置下标
    _.sortedIndex = function(array, obj, iteratee, context) {
        // 注意 cb 方法
        // iteratee 为空 || 为 String 类型（key 值） 时 => iteratee会变成不同的函数
        iteratee = cb(iteratee, context, 1);

        // value是将要被插入的值
        var value = iteratee(obj);
        var low = 0, high = getLength(array);

        // 二分查找
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value)
                low = mid + 1;
            else
                high = mid;
        }

        return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    // _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    // _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);
    //_.lastIndexOf的第三个参数为空，所以他不能调用二分查找来加速，只能遍历查找
    function createIndexFinder(dir, predicateFind, sortedIndex) {
        // API 调用形式
        // _.indexOf(array, value, [fromIndex])
        // _.lastIndexOf(array, value, [fromIndex])
        //idx可能是数字，代表遍历的起点；也可能为true（布尔值），代表array有序可以使用二分查找
        return function(array, item, idx) {
            var i = 0, length = getLength(array);

            // 如果 idx 为 Number 类型
            // 那么idx就是查找位置的起始点，包括正向和反向
            //反向查找就是从起始点开始往前找，在起始点后面的点会被忽略
            if (typeof idx == 'number') {
                if (dir > 0) {
                    // 正向查找
                    // 重置查找的起始位置
                    // i>=0, i可以超出length
                    //在idx<0时，相当于从array最后一项往回数，如果idx+length>0,那么i=idx+length。
                    //i是正向查找的起始位置
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    // 反向查找
                    // 如果是反向查找，重置 length 属性值
                    // idx 是下标，他比length小1，所以计算length的时候要加上 1
                    //length<=原来的length ,length可以为负
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                    // console.log(length);
                }
            } else if (sortedIndex && idx && length) {
                // _.indexOf(array, value, [isSorted])
                // 如果您正在使用一个大数组，你知道数组已经排序，传递true给isSorted将更快的用二进制搜索
                // 能用二分查找加速的条件
                // sortedIndex!=null(_.indexOf情况下) & idx === true && length !== 0
                // 用 _.sortIndex 找到有序数组中 item 正好插入的位置
                idx = sortedIndex(array, item);

                // 如果正好插入的位置的值和 item 刚好相等
                // 说明该位置就是 item 第一次出现的位置
                // 返回下标
                // 否则即是没找到，返回 -1
                return array[idx] === item ? idx : -1;
            }

            // 特判，如果要查找的元素是 NaN 类型
            // 如果 item !== item
            // 那么 item => NaN
            if (item !== item) {
                //找到第一个NaN类型的下标返回
                //这里的slice函数在_.lastIndexOf情况下有个小bug，因为length可能是负数。slice函数的第二个参数为负的话，会从数组的末尾截取
                //会导致判断NAN的时候出错
                //比如：
                // console.log(_.lastIndexOf([1, 2, 3, 1, NaN, 0], NaN,-8));
                // console.log(_.lastIndexOf([1, 2, 3, 1, 10, 0], 10,-8));
                // 但是在真正使用时很少会这样写
                // 将slice产生的array，用_.isNaN判断
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                // console.log(slice.call(array, i, length));
                return idx >= 0 ? idx + i : -1;
            }

            // O(n) 遍历数组
            // 寻找和 item 相同的元素
            // 特判排除了 item 为 NaN 的情况
            // 可以放心地用 `===` 来判断是否相等了
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }

            return -1;
        };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    // _.indexOf(array, value, [isSorted])
    // 找到数组 array 中 value 第一次出现的位置
    // 并返回其下标值
    // 如果数组有序，则第三个参数可以传入 true
    // 这样算法效率会更高（二分查找）
    // [isSorted] 参数表示数组是否有序
    // 同时第三个参数也可以表示 [fromIndex] （见下面的 _.lastIndexOf）
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

    // 和 _indexOf 相似
    // 反序查找
    // _.lastIndexOf(array, value, [fromIndex])
    // [fromIndex] 参数表示从倒数第几个开始往前找
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    // 返回某一个范围内的数组成的数组
    //
    _.range = function(start, stop, step) {
        if (stop == null) {
            //如果没有指定stop，就默认[0,start]
            //_.range(10);
            // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            stop = start || 0;
            start = 0;
        }
        //step 默认为 1
        step = step || 1;

        // 返回数组的长度
        //_.range(0); => length=0
        // => []
        var length = Math.max(Math.ceil((stop - start) / step), 0);

        // 返回的数组
        var range = Array(length);

        for (var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }

        return range;

    };


    // Function (ahem) Functions
    // 函数的扩展方法
    // 共 14 个扩展方法
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    // 这个函数执行绑定功能，同时根据是否是new调用，来判断是否需要返回对象，或者是直接绑定好执行
    // sourceFunc是需要绑定this的函数，boundFunc是调用bind后返回的已绑定好this的函数，context是this的指向
    // callingContext是调用这个函数的context，可能是window，也可能是new出来的对象，args是参数

    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
        // 对boundFunc直接调用时，即直接boundFunc(), 传入的this，也就是callingContext指向global object，在浏览器中指window
        // 所以直接调用时，callingContext instanceof boundFunc  =>  false
        // 所以此时不是new调用直接绑定好context，并传入参数后执行
        if (!(callingContext instanceof boundFunc))
            return sourceFunc.apply(context, args);

        // 如果是用 new 调用boundFunc
        // self 为 sourceFunc 的实例，继承了它的原型链
        // self 理论上是一个空对象（还没赋值），但是有原型链
        var self = baseCreate(sourceFunc.prototype);

        // 这里是为了语义一致，以new调用函数时，若函数返回对象，则那个对象作为构造函数的返回值
        // 否则返回一个运行时自动给你创建的对象（并且给你加上了原型）
        var result = sourceFunc.apply(self, args);

        // 如果构造函数返回了对象
        // 则 new 的结果是这个对象
        // 返回这个对象
        if (_.isObject(result)) return result;

        // 否则返回 self
        // var result = sourceFunc.apply(self, args);
        // self 对象当做参数传入
        // 会直接改变值
        return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    // ES5 bind 方法的扩展（polyfill）
    // 将 func 中的 this 指向 context（对象）
    // _.bind(function, object, *arguments)
    // 可选的 arguments 参数会被当作 func 的参数传入
    // func 在调用时，会优先用 arguments 参数，然后使用 _.bind 返回方法所传入的参数
    _.bind = function(func, context) {
        // 如果浏览器支持 ES5 bind 方法，并且 func 上的 bind 方法没有被重写
        // 则优先使用原生的 bind 方法
        if (nativeBind && func.bind === nativeBind)
          return nativeBind.apply(func, slice.call(arguments, 1));
        // 如果传入的参数 func 不是方法，则抛出错误
        if (!_.isFunction(func))
            throw new TypeError('Bind must be called on a function');
        // 调用bind时可以传入参数，调用bind返回的函数时也可以传入参数，但是bind时参入的参数优先使用
        // polyfill
        // 经典闭包，函数返回函数
        // args 获取优先使用的参数，也就是bind时传入的参数
        var args = slice.call(arguments, 2);
        //返回的bound函数
        var bound = function() {
            // args.concat(slice.call(arguments))
            // 最终函数的实际调用参数由两部分组成
            // 一部分是传入 _.bind 的参数（会被优先调用）
            // 另一部分是传入 bound（_.bind 所返回方法）的参数
            // slice.call(arguments)中的arguments是调用bound函数时传入的参数
            // slice.call(arguments)将arguments转化为 Array
            // bound被传入executeBound中用来检测bound函数是否被new调用
            return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
        };

        return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    // _.partial(function, *arguments)
    // 局部应用一个函数填充在任意个数的 arguments，不改变其动态this值。和bind方法很相近。
    // 你可以传递_ 给arguments列表来指定一个不预先填充，但在调用时提供的参数。
    // Using a placeholder
    //     subFrom20 = _.partial(subtract, _, 20);
    //     subFrom20(5);
    // => 15
    _.partial = function(func) {
        // 提取希望 pre-fill 的参数
        // 如果传入的是 _，则这个位置的参数暂时空着，等待手动填入
        // boundArgs是 _.partial时传入的参数，参数可能包含占位符 _
        var boundArgs = slice.call(arguments, 1);
        var bound = function() {
            var position = 0, length = boundArgs.length;
            var args = Array(length);
            for (var i = 0; i < length; i++) {
                // 如果该位置的参数为 _，则用 boundArgs 填充这个位置
                // args 通过合并arguments和boundArgs得到最终传入的参数
                args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
            }
            // bound 方法还有剩余的 arguments，添上去
            // 这里是考虑了boundArgs没有传入所有的参数，并且也没有给出占位符
            while (position < arguments.length)
                args.push(arguments[position++]);
            //由于直接将this传递给callingContext参数，所以他不改变函数原有的this指向
            return executeBound(func, bound, this, this, args);
        };

        return bound;
    };

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    // 将对象上的方法的 this 指向该对象，这样直接调用该方法时，this已经绑定好了
    // _.bindAll(object, *methodNames)
    //    function Person(name){
    //     this.name = name;
    //     this.greet = function(){
    //         console.log("hello everyone, I am " + this.name);
    //     };
    // }
    // var tom = new Person("Tom");
    // _.bindAll(tom,"greet");
    // var greet = tom.greet();
    // greet();//输出<hello everyone, I am Tom>
    _.bindAll = function(obj) {
        var i, length = arguments.length, key;
        // 如果只传入了一个参数（obj），没有传入 methodNames，则报错
        if (length <= 1)
            throw new Error('bindAll must be passed function names');

        // 遍历 methodNames
        for (i = 1; i < length; i++) {
            key = arguments[i];
            // 将obj[key]绑定到obj上
            obj[key] = _.bind(obj[key], obj);
        }
        return obj;
    };

    // Memoize an expensive function by storing its results.
    //「记忆化」，存储中间运算结果，提高效率
    // 参数 hasher 是个 function，用来计算 address
    // 如果传入了 hasher，则用 hasher 来计算 address
    // 否则用传入的key 当 address
    // _.memoize(function, [hashFunction])
    // 适用于需要大量重复求值的场景
    // 比如递归求解菲波那切数
    // @http://www.jameskrob.com/memoize.html
    // create hash for storing "expensive" function outputs
    // run expensive function
    // check whether function has already been run with given arguments via hash lookup
    // if false - run function, and store output in hash
    // if true, return output stored in hash
    // _.memorize()是通过缓存来实现优化的，只要之后的运算用到了之前缓存下来的结果，那就是有优化了。
    // var memo_fibonacci = _.memorize(fibonacci);
    // memo_fibonacci(30);
    // memo_fibonacci(n); 上一次的cache其实缓存了[0,30]的值，不单单是n=30的值。
    _.memoize = function(func, hasher) {
        var memoize = function(key) {
            // 储存变量，方便使用
            var cache = memoize.cache;

            // 求key
            // 如果传入了 hasher，则用 hasher 函数来计算 key, hasher的参数通过arguments传入
            // 否则用参数 key 当 address
            var address = '' + (hasher ? hasher.apply(this, arguments) : key);
            // 如果这个 key 还没被 hash 过（还没求过值）
            if (!_.has(cache, address))
                cache[address] = func.apply(this, arguments);

            console.log(cache);
            // 返回
            return cache[address];
        };
        // cache是memoize函数的一个属性
        // cache 对象被当做 key-value 键值对缓存中间运算结果
        memoize.cache = {};
        // 返回一个函数
        return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    // 延迟触发某方法
    // _.delay(function, wait, *arguments)
    //  如果传入了 arguments 参数，则会被当作 func 的参数在触发时调用
    // 其实是封装了「延迟触发某方法」，使其复用
    //_.delay(console.log, 1000, 'logged later');
    _.delay = function(func, wait) {
        // 获取 *arguments
        // 是 func 函数所需要的参数
        var args = slice.call(arguments, 2);
        return setTimeout(function(){
            // 将参数赋予 func 函数
            return func.apply(null, args);
        }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    // 延迟调用function直到当前调用栈清空为止，类似使用延时为0的setTimeout方法
    // 和 setTimeout(func, 0) 相似（源码看来似乎应该是 setTimeout(func, 1)）
    // _.defer(function, *arguments)
    // 如果传入 *arguments，会被当做参数，和 _.delay 调用方式类似（少了第二个参数）
    // 其实核心还是调用了 _.delay 方法，但第二个参数（wait 参数）设置了默认值为 1
    // 使用 _.partial 方法来延迟传入func给_.delay
    // _.defer(function(){ alert('deferred'); });
    _.defer = _.partial(_.delay, _, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    // 函数节流（如果有连续事件响应，则每间隔一定时间段触发）
    // 每间隔 wait(Number) milliseconds 触发一次 func 方法
    // 如果 options 参数传入 {leading: false}
    // 那么不会马上触发（等待 wait milliseconds 后第一次触发 func）
    // 如果 options 参数传入 {trailing: false}
    // 那么最后一次回调不会被触发
    // **Notice: options 不能同时设置 leading 和 trailing 为 false**
    // 示例：
    // window.onscroll = _.throttle(log, 1000);
    // window.onscroll = _.throttle(log, 1000, {leading: false});
    // window.onscroll = _.throttle(log, 1000, {trailing: false});
    // 以scroll为例，滚动开始时会触发一次函数
    // 滚动结束后也会触发一次，所以正常情况下，都会触发两次函数。
    // 但是可以通过 {trailing: false} {leading: false}配置
    // 实现方法：其一通过previous记录上一次执行的时间，判断是否已经wait足够久，如果是，则执行，并更新上次执行的时间戳，如此循环；
    // 其二使用定时器，每次真正执行函数之前，如果已经存在定时器，则不执行。直到定时器触发，handler 被清除，然后执行，并重新设置定时器。
    // ----------------------------------------- //
    _.throttle = function(func, wait, options) {
        var context, args, result;
        // setTimeout 的 handler
        var timeout = null;
        // 标记时间戳
        // 上一次执行函数的时间戳
        var previous = 0;
        // 如果没有传入 options 参数
        // 则将 options 参数置为空对象
        if (!options)
            options = {};

        var later = function() {
            // 如果 options.leading === false，即每次开始不执行
            // 则每次触发回调后将 previous 置为 0，相当于每次都是第一次执行，那么后面就会一直跳过这次执行
            // console.log("later");
            previous = options.leading === false ? 0 : _.now();
            timeout = null;
            result = func.apply(context, args);

            // 这里的 timeout 变量一定是 null 了吧
            // 检测是为了 防止递归调用，产生新的timeout
            if (!timeout)
                context = args = null;
        };

        // 以滚轮事件为例（scroll）
        // 每次触发滚轮事件即执行这个返回的方法
        // _.throttle 方法返回的函数
        return function() {
            // 记录当前时间戳
            var now = _.now();

            // 第一次执行回调,此时 previous 为 0，之后 previous 值为上一次时间戳
            // 如果程序设定第一个回调不是立即执行的（options.leading === false）
            // 则将 previous 值设为 now 的时间戳,跳过第一次执行
            if (!previous && options.leading === false)
                previous = now;
            // 距离下次触发 func 还需要等待的时间
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            // remaining<=0代表等待时间已经够久了，可以立即执行函数
            // 注意，传入 {leading: false}的第一次调用的情况下
            // previous 为 0，wait - (now - previous) 也满足 <= 0
            // ========= //
            // remaining > wait，表示客户端系统时间被调整过
            // 则马上执行 func 函数
            // @see https://blog.coding.net/blog/the-difference-between-throttle-and-debounce-in-underscorejs
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    // clearTimeout(timeout)后，timeout的值并不会清空，
                    // 如果不设置为null，就不能根据!timeout重置引用
                    timeout = null;
                }
                // 重置前一次触发的时间戳
                previous = now;
                // 触发方法
                // result 为该方法返回值
                result = func.apply(context, args);
                // console.log("pre");
                // 引用置为空，防止内存泄露
                // 感觉这里的 timeout 肯定是 null 啊？这个 if 判断没必要吧？
                if (!timeout)
                    context = args = null;
            } else if (!timeout && options.trailing !== false) { // 最后一次需要触发的情况
                // 所有的结束后，timeout的定时器应该被设置为null
                // 如果已经存在一个定时器，则不会进入该 if 分支
                // 如果 {trailing: false}，即最后一次不需要触发了，也不会进入这个分支
                // 间隔 remaining milliseconds 后触发 later 方法
                timeout = setTimeout(later, remaining);
            }
            // 回调返回值
            return result;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    // 函数去抖（连续事件触发结束后只触发一次）
    // 函数去抖的意思是，在多次连续调用同一个函数时，在最后一次调用的wait时间过后真正调用该函数
    // sample 1: _.debounce(function(){}, 1000)
    // 连续事件结束后的 1000ms 后触发
    // sample 1: _.debounce(function(){}, 1000, true)
    // 连续事件第一次触发后立即触发（此时会忽略第二个参数）
    // 实现方法：在多次连续调用的每一次都设置setTimeout，直到最后一次调用的wait时间后，由setTimeout执行函数
    _.debounce = function(func, wait, immediate) {
        var timeout, args, context, timestamp, result;

        var later = function() {
            // 求出最后一次调用和现在时间的时间间隔
            var last = _.now() - timestamp;

            // 时间间隔 last 在 [0, wait) 中
            // 还没到触发的点，则继续设置定时器，还需等待wait-last的时间
            // 到时间后会重新调用later函数
            if (last < wait && last >= 0) {
                timeout = setTimeout(later, wait - last);
            } else {
                // 到了可以触发的时间点
                timeout = null;
                //这里的if (!immediate)判断是因为，首先无论immediate的值是否设置，都会进入later函数
                //但是immediate为true，那么在第一次调用时callNow也为true，他会在函数调用的时候直接执行
                //这种情况下就不用重复执行了
                if (!immediate) {
                    // 执行 func 函数
                    result = func.apply(context, args);
                    // 这里的 timeout 一定是 null 了吧
                    // 感觉这个判断多余了
                    if (!timeout)
                        context = args = null;
                }
            }
        };


        return function() {
            context = this;
            args = arguments;

            // 每次调用函数，更新timestamp
            // timestamp会在later 方法中用到
            // timestamp在多次调用的情况下，是最后一次的调用时间
            timestamp = _.now();

            // 立即触发需要满足两个条件
            // immediate 参数为 true，并且 timeout 还没设置
            // immediate 参数为 true 是显而易见的
            // 如果去掉 !timeout 的条件，就会一直触发，而不是触发一次
            // 因为第一次触发后已经设置了 timeout，所以根据 timeout 是否为空可以判断是否是首次触发
            var callNow = immediate && !timeout;

            // 设置 wait seconds 后触发 later 方法
            // 无论是否 callNow（如果是 callNow，也进入 later 方法，在 later 方法中判断是否执行相应回调函数）
            // 在某一段的连续触发中，只会在第一次触发时进入这个 if 分支中
            if (!timeout)
            // 设置了 timeout，所以以后不会进入这个 if 分支了
                timeout = setTimeout(later, wait);

            // 立即出发会在第一次执行这个函数时就直接执行
            if (callNow) {
                // func 可能是有返回值的
                result = func.apply(context, args);
                // 解除引用
                context = args = null;
            }

            return result;
        };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    //var hello = function(name) { return "hello: " + name; };
    //     hello = _.wrap(hello, function(func) {
    //         return "before, " + func("moe") + ", after";
    //     });
    //     hello();
    // => 'before, hello: moe, after'
    //将function 封装到函数 wrapper 里面
    _.wrap = function(func, wrapper) {
        //相当于将func当做参数传递给wrapper
        return _.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    // 返回一个 predicate 方法的对立方法
    // 即该方法可以对原来的 predicate 迭代结果值取补集
    _.negate = function(predicate) {
        return function() {
            return !predicate.apply(this, arguments);

        };
    };


    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    // _.compose(*functions)
    // var tmp = _.compose(f, g, h)
    // tmp(args) => f(g(h(args)))
    //复合函数:一个函数执行完之后把返回的结果再作为参数赋给下一个函数来执行.
    //var greet    = function(name){ return "hi: " + name; };
    //     var exclaim  = function(statement){ return statement.toUpperCase() + "!"; };
    //     var welcome = _.compose(greet, exclaim);
    //     welcome('moe');
    // => 'hi: MOE!'
    _.compose = function() {
        var args = arguments; // funcs
        var start = args.length - 1; // 倒序调用
        return function() {
            var i = start;

            var result = args[start].apply(this, arguments);
            // 一个一个方法地执行
            while (i--)
                result = args[i].call(this, result);
            return result;
        };
    };

    // Returns a function that will only be executed on and after the Nth call.
    // 第 times 触发执行 func（事实上之后的每次触发还是会执行 func）
    // 有什么用呢？
    // 如果有 N 个异步事件，所有异步执行完后执行该回调，即 func 方法（联想 eventproxy）
    // _.after 会返回一个函数
    // 当这个函数至少被调用 times 后才真正执行
    _.after = function(times, func) {
        return function() {
            // 事实上 times 次后如果函数继续被执行，也会触发 func
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    // 函数至多被调用 times - 1 次（(but not including) the Nth call）
    // func 函数会触发 time - 1 次（Creates a version of the function that can be called no more than count times）
    // func 函数有个返回值，前 time - 1 次触发的返回值都是将参数代入重新计算的
    // 第 times 开始的返回值为第 times - 1 次时的返回值（不重新计算）
    // The result of the last function call is memoized and returned when count has been reached.
    _.before = function(times, func) {
        var memo;
        return function() {
            if (--times > 0) {
                // 缓存函数执行结果
                memo = func.apply(this, arguments);
            }

            // func 引用置为空，其实不置为空也用不到 func 了
            if (times <= 1)
                func = null;

            // 前 times - 1 次触发，memo 都是分别计算返回
            // 第 times 次开始，memo 值同 times - 1 次时的 memo
            return memo;
        };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    // 函数至多只能被调用一次
    // 适用于这样的场景，某些函数只能被初始化一次，不得不设置一个变量 flag
    // 初始化后设置 flag 为 true，之后不断 check flag
    // ====== //
    // 其实是调用了 _.before 方法，并且将 times 参数设置为了默认值 2（也就是 func 至多能被调用 2 - 1 = 1 次）
    _.once = _.partial(_.before, 2);


    // Object Functions
    // 对象的扩展方法
    // 共 38 个扩展方法
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    // IE < 9 下 不能用 for key in ... 来枚举对象的某些 key
    // 比如重写了对象的 `toString` 方法，这个 key 值就不能在 IE < 9 下用 for in 枚举到
    // IE < 9，{toString: null}.propertyIsEnumerable('toString') 返回 false
    // IE < 9，重写的 `toString` 属性被认为不可枚举
    // 据此可以判断是否在 IE < 9 浏览器环境中
    var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');

    // IE < 9 下不能用 for in 来枚举的 key 值集合
    // 其实还有个 `constructor` 属性
    // 个人觉得可能是 `constructor` 和其他属性不属于一类
    // nonEnumerableProps[] 中都是方法
    // 而 constructor 表示的是对象的构造函数
    // 所以区分开来了
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    // obj 为需要遍历键值对的对象
    // keys 为obj的for in循环遍历得到的键数组
    // 判断obj中是否有for in循环遍历不到的键，将他们push进keys数组中。当然不包括该对象原型链上的属性
    // 利用 JavaScript 按值传递的特点
    // 传入数组作为参数，能直接改变数组的值
    function collectNonEnumProps(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;

        // 获取对象的原型。
        // 如果 obj 的 constructor 被更改了指向，那么proto=Object.prototype
        // 如果没有被更改指向 proto = obj.constructor.prototype
        var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

        // Constructor is a special case.
        // `constructor` 属性需要特殊处理 (是否有必要？)
        // see https://github.com/hanzichi/underscore-analysis/issues/3
        // 如果 obj 有 `constructor` 这个 key
        // 并且该 key 没有在 keys 数组中
        // 存入 keys 数组
        var prop = 'constructor';
        //_.has(obj, prop)中has使用hasOwnproperty，hasOwnProperty 会获取 obj对象 本身的 可迭代和不可迭代的属性，
        // 不会获取原型上面的任何属性；
        if (_.has(obj, prop) && !_.contains(keys, prop))
            keys.push(prop);

        // 遍历 nonEnumerableProps 数组中的 keys
        while (nonEnumIdx--) {
            prop = nonEnumerableProps[nonEnumIdx];
            // prop in obj，应该是为了避免一种特殊情况，就是obj的原型链是null的情况。可以人为地把obj的原型链置为null
            // obj[prop] !== proto[prop] 判断obj是否重写了原型链上的属性，该 key 是否来自于原型链
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                keys.push(prop);
            }
        }
    }

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    // ===== //
    // _.keys({one: 1, two: 2, three: 3});
    // => ["one", "two", "three"]
    // ===== //
    // 返回一个对象的 keys 组成的数组
    // 仅返回 自己的（不包括原型链上的属性） 可数的 键 组成的数组,
    _.keys = function(obj) {
        // 容错
        // 如果传入的参数不是对象，则返回空数组
        if (!_.isObject(obj)) return [];

        // 如果浏览器支持 ES5 Object.key() 方法
        // 则优先使用该方法
        if (nativeKeys) return nativeKeys(obj);

        var keys = [];
        //下面这个循环会将可数的，并且是自己的不是原型链上的 key push进keys
        //for in会遍历原型链上的可数属性
        // own enumerable properties
        for (var key in obj)
            // _.has(obj,key)内部使用 hasOwnProperty ，它是 JavaScript 中唯一一个处理属性但是不查找原型链的函数。
            //hasOwnProperty遍历对象本身的可数和不可数的属性
            if (_.has(obj, key))
                //for in + hasOwnProperty 得到对象本身的，可数的属性
                keys.push(key);

        // Ahem, IE < 9.
        // IE < 9 下不能用 for in 来枚举某些 key 值
        // 传入 keys 数组为参数
        // 因为 JavaScript 下函数参数按值传递
        // 所以 keys 当做参数传入后会在 `collectNonEnumProps` 方法中改变值
        if (hasEnumBug) collectNonEnumProps(obj, keys);

        return keys;
    };

    // Retrieve all the property names of an object.
    // 返回一个对象的 keys 数组
    // 不仅仅是 own enumerable properties
    // 还包括原型链上继承的属性
    _.allKeys = function(obj) {
        // 容错
        // 不是对象，则返回空数组
        if (!_.isObject(obj)) return [];

        //与_.keys相比，没有使用hasOwnProperty过滤，所以会包括原型链上的属性
        var keys = [];
        for (var key in obj)
            keys.push(key);

        // Ahem, IE < 9.
        // IE < 9 下的 bug，同 _.keys 方法
        if (hasEnumBug) collectNonEnumProps(obj, keys);

        return keys;
    };

    // Retrieve the values of an object's properties.
    // ===== //
    // _.values({one: 1, two: 2, three: 3});
    // => [1, 2, 3]
    //_.values不是数组的方法

    // 将一个对象的所有 values 值放入数组中
    // 仅限 own properties 上的 values
    // 不包括原型链上的
    // 并返回该数组
    //_.values内部是使用_.keys(obj)来获得对应的值
    _.values = function(obj) {
        // 仅包括 own properties
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    // 跟 _.map 方法很像
    // 但是用于对象
    // 迭代函数改变对象的 values 值
    // 返回对象副本
    //_.mapObject({start: 5, end: 12}, function(val, key) {
    //     return val + 5;
    // });
    // => {start: 10, end: 17}
    _.mapObject = function(obj, iteratee, context) {
        // 迭代函数
        // 对每个键值对进行迭代
        iteratee = cb(iteratee, context);

        var keys =  _.keys(obj),
            length = keys.length,
            results = {}, // 对象副本，该方法返回的对象
            currentKey;

        for (var index = 0; index < length; index++) {
            currentKey = keys[index];
            // key 值不变
            // 对每个 value 值用迭代函数迭代
            // 返回经过函数运算后的值
            // iteratee(value,key,obj)
            results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    // 将一个对象转换为元素为 [key, value] 形式的数组
    // _.pairs({one: 1, two: 2, three: 3});
    // => [["one", 1], ["two", 2], ["three", 3]]
    _.pairs = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    // 将一个对象的 key-value 键值对颠倒
    // 即原来的 key 为 value 值，原来的 value 值为 key 值
    // 需要注意的是，value 值不能重复（不然后面的会覆盖前面的）
    // 且新构造的对象符合对象构造规则
    // 并且返回新构造的对象
    //_.invert({Moe: "Moses", Larry: "Louis", Curly: "Jerome"});
    // => {Moses: "Moe", Louis: "Larry", Jerome: "Curly"};
    _.invert = function(obj) {
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            // result[value]=key;
            result[obj[keys[i]]] = keys[i];
        }
        return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    // 返回一个对象里所有的方法名（function）, 而且是已经排序的,（包括 own properties 以及 原型链上的）
    //_.functions(_);
    // => ["all", "any", "bind", "bindAll", "clone", "compact", "compose" ...
    _.functions = _.methods = function(obj) {
        // 返回的数组
        var names = [];
        // for in 循环会遍历包括对象原型链上的可数属性，在IE<9有一些属性无法遍历到，但是这里没有处理
        // 所以在IE<9下，有些属性被放弃了，其实可以直接使用_.keys
        for (var key in obj) {
            // 如果某个 key 对应的 value 值类型是函数
            // 则将这个 key 值存入数组
            if (_.isFunction(obj[key])) names.push(key);
        }

        // 返回排序后的数组
        return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    // extend_.extend(destination, *sources)
    // Copy all of the properties in the source objects over to the destination object
    // and return the destination object
    // It's in-order, so the last source will override properties of the same name in previous arguments.
    // 将几个对象上（第二个参数开始，根据参数而定）的所有键值对添加到 destination 对象（第一个参数）上
    // 因为 key 值可能会相同，所以后面的（键值对）可能会覆盖前面的
    // 参数个数 >= 1
    _.extend = createAssigner(_.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    // 跟 extend 方法类似，但是只把 own properties 拷贝给第一个参数对象
    // 只继承 own properties 的键值对,不包括继承过来的属性
    // 参数个数 >= 1
    _.extendOwn = _.assign = createAssigner(_.keys);

    // Returns the first key on an object that passes a predicate test
    // 跟数组方法的 _.findIndex 类似
    // 找到对象的键值对中第一个满足条件的键值对
    // 并返回该键值对 key 值
    _.findKey = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj), key;
        // 遍历键值对
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            // 符合条件，直接返回 key 值，key是对象中的键（属性）
            if (predicate(obj[key], key, obj)) return key;
        }
    //    不然返回undefined
    };

    // Return a copy of the object only containing the whitelisted properties.
    // 根据一定的需求（key 值，或者通过 predicate 函数返回真假）
    // 返回拥有一定键值对的对象副本
    // 第二个参数可以是一个 predicate 函数
    // 也可以是 >= 0 个 key
    // _.pick(object, *keys)
    // Return a copy of the object
    // filtered to only have values for the whitelisted keys (or array of valid keys)
    // Alternatively accepts a predicate indicating which keys to pick.
    /*
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
     => {name: 'moe', age: 50}
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, ['name', 'age']);
     => {name: 'moe', age: 50}
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
     return _.isNumber(value);
     });
     => {age: 50}
     */
    _.pick = function(object, oiteratee, context) {
        // result 为返回的对象副本
        var result = {}, obj = object, iteratee, keys;

        // 容错
        if (obj == null) return result;

        // 如果第二个参数是函数
        if (_.isFunction(oiteratee)) {
            //只有在oiteratee是function的情况下，第三个参数才是context
            keys = _.allKeys(obj);
            iteratee = optimizeCb(oiteratee, context);
        } else {
            // 如果第二个参数不是函数
            // 则后面的 keys 可能是数组
            // 也可能是连续的几个并列的参数
            // 用 flatten 将它们展开,startIndex=1
            keys = flatten(arguments, false, false, 1);

            // 也转为 predicate 函数判断形式
            // 将指定 key 转化为 predicate 函数
            iteratee = function(value, key, obj) { return key in obj; };
            obj = Object(obj);
        }

        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var value = obj[key];
            // 满足条件
            if (iteratee(value, key, obj)) result[key] = value;
        }
        return result;
    };

    // Return a copy of the object without the blacklisted properties.
    // 跟 _.pick 方法相对
    // 返回 _.pick 的补集
    // 即返回没有指定 keys 值的对象副本
    // 或者返回不能通过 predicate 函数的对象副本
    _.omit = function(obj, iteratee, context) {
        if (_.isFunction(iteratee)) {
            // _.negate 方法对 iteratee 的结果取反
            iteratee = _.negate(iteratee);
        } else {
            var keys = _.map(flatten(arguments, false, false, 1), String);
            iteratee = function(value, key) {
                //返回key是否在keys中的非
                //_.contains(list, value, [fromIndex])
                return !_.contains(keys, key);
            };
        }
        return _.pick(obj, iteratee, context);
    };

    // _.defaults(object, *defaults)
    // Fill in a given object with default properties.
    // Fill in undefined properties in object
    // with the first value present in the following list of defaults objects.
    // 和 _.extend 非常类似
    // 区别是如果 *defaults 中出现了和 object 中一样的键
    // 则不覆盖 object 的键值对
    // 如果 *defaults 多个参数对象中有相同 key 的对象
    // 则取最早出现的 value 值
    // 参数个数 >= 1
    _.defaults = createAssigner(_.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    // 给定 prototype
    // 以及一些 own properties
    // 构造一个新的对象并返回
    // _.crypto.createECDH(curve) = function(prototype, props) {
    //   var result = baseCreate(prototype);

    //   // 将 props 的键值对覆盖 result 对象
    //   if (props) _.extendOwn(result, props);
    //   return result;
    // };

    // Create a (shallow-cloned) duplicate of an object.
    // 对象的 `浅复制` 副本
    // 注意点：所有嵌套的对象或者数组都会跟原对象用同一个引用
    // 所以是为浅复制，而不是深度克隆
    _.clone = function(obj) {
        // 容错，如果不是对象或者数组类型，则可以直接返回
        // 因为一些基础类型是直接按值传递的
        // 思考，arguments 呢？ Nodelists 呢？ HTML Collections 呢？
        if (!_.isObject(obj))
            return obj;

        // 如果是数组，则用 obj.slice() 返回数组副本,也就是返回一个新数组副本
        // 如果是对象，则提取所有 obj 的键值对覆盖空对象，返回一个新对象副本
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    // _.chain([1,2,3,200])
    // .filter(function(num) { return num % 2 == 0; })
    // .tap(alert)
    // .map(function(num) { return num * num })
    // .value();
    // => // [2, 200] (alerted)
    // => [4, 40000]
    // 主要是用在链式调用中
    // 对中间值立即进行处理
    _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    // attrs 参数为一个对象
    // _.isMatch(object, attrs)判断 object 对象中是否有 attrs 中的所有 key-value 键值对，object的键值对是否包含attrs的键值对
    // 返回布尔值
    //var stooge = {name: 'moe', age: 32};
    //     _.isMatch(stooge, {age: 32});
    // => true
    _.isMatch = function(object, attrs) {
        // 提取 attrs 对象的所有 keys
        var keys = _.keys(attrs), length = keys.length;

        // 如果 object 为空
        // 根据 attrs 的键值对数量返回布尔值
        if (object == null) return !length;

        // 进行强制转换，防止参数obj不是Object
        var obj = Object(object);

        // 遍历 attrs 对象键值对
        for (var i = 0; i < length; i++) {
            var key = keys[i];

            // 如果 obj 对象没有 attrs 对象的某个 key
            // 或者对于某个 key，它们的 value 值不同
            // 则证明 object 并不拥有 attrs 的所有键值对
            // 则返回 false
            if (attrs[key] !== obj[key] || !(key in obj)) return false;
        }

        return true;
    };


    // Internal recursive comparison function for `isEqual`.
    // 递归比较两个对象是否相等
    var eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
        // 需要注意虽然`0 === -0` ，但是在underscore中，0 和 -0 被认为不相同（unequal）
        // 至于原因可以参考上面的链接

        // 判断a===b时，是不是-0和0的特殊情况。1/0=>Infinity.1/-0 => -Infinity
        if (a === b) return a !== 0 || 1 / a === 1 / b;

        // A strict comparison is necessary because `null == undefined`.
        // 对存在null或undefined的比较需要使用严格的===
        // null == undefined =>true, null === undefined =>true
        // 如果 a 和 b 有一个为 null（或者 undefined）
        // 判断 a === b
        if (a == null || b == null) return a === b;

        // Unwrap any wrapped objects.
        // 如果 a 和 b 是 underscore OOP 的对象
        // 那么比较 _wrapped 属性值（Unwrap）
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;

        // Compare `[[Class]]` names.
        // 用 Object.prototype.toString.call 方法获取 a 变量类型
        var className = toString.call(a);

        // 如果 a 和 b 类型不相同，则返回 false
        if (className !== toString.call(b)) return false;

        switch (className) {
            // Strings, numbers, regular expressions, dates, and booleans are compared by value.
            // 以上五种类型的元素可以直接根据其 value 值来比较是否相等
            case '[object RegExp]':
            // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                // "5"===new String("5") =>false
                // ''+"5"===new String("5")+'' =>true
                // 转为 String 类型进行比较
                return '' + a === '' + b;

            // ================

            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive.
                // Object(NaN) is equivalent to NaN
                // NaN === NaN =>false
                // NaN !== NaN => true
                // 如果 +a !== +a,那么 a 就是 NaN
                // 判断 b 是否也是 NaN 即可
                if (+a !== +a) return +b !== +b;

                // An `egal` comparison is performed for other numeric values.
                // 排除了 NaN 干扰
                // 还要考虑 0 的干扰
                // 用 +a 将 Number() 形式转为基本类型
                // 即 +Number(1) ==> 1
                // 0 需要特判
                // 如果 a 为 0，判断 1 / +a === 1 / b =>判断0 -0
                // 否则判断 +a === +b
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;

            // 如果 a 为 Number 类型
            // 要注意 NaN 这个 special number
            // NaN 和 NaN 被认为 equal
            // ================

            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a === +b;

            // Date 和 Boolean 可以看做一类
            // 如果 obj 为 Date 或者 Boolean
            // 那么 +obj 会将 obj 转为 Number 类型
            // 然后比较即可
            // +new Date() 是当前时间距离 1970 年 1 月 1 日 0 点的毫秒数
        }


        // 判断 a 是否是数组
        var areArrays = className === '[object Array]';

        // 如果 a 不是数组类型
        if (!areArrays) {
            // 如果 a 不是 object 或者 b 不是 object
            // 则返回 false
            // typeof [1] =>object
            if (typeof a != 'object' || typeof b != 'object') return false;

            // 通过上个步骤的 if 过滤
            // 保证到此的 a 和 b 均为对象，然后判断两个对象是否相同
            // 如果两个对象的构造函数不相同，并且他们的构造函数不是Object构造函数的情况下 => 两个对象不相同
            // 也就是说在两个对象的构造函数不相同的情况下，两个对象还是可能相同，比如：
            // var attrs = Object.create(null);
            // attrs.name = "Bob";
            // console.log(_.isEqual(attrs, {name: "Bob"})); =>  true

            // Objects with different constructors are not equivalent, but `Object`s or `Array`s
            // from different frames are.

            // Object instanceof Object =>true ,如果aCtor instanceof aCtor =>true,那么aCtor是构造函数Object
            var aCtor = a.constructor, bCtor = b.constructor;
            // 如果两个对象的构造函数不相同，并且两个构造函数都不是Object，那么返回false
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                _.isFunction(bCtor) && bCtor instanceof bCtor)
                && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }

        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

        // Initializing stack of traversed objects.
        // It's done here since we only need them for objects and arrays comparison.

        // 第一次调用 eq() 函数，没有传入 aStack 和 bStack 参数
        // 之后递归调用都会传入这两个参数
        aStack = aStack || [];
        bStack = bStack || [];
        //每次递归都取得a栈的长度
        var length = aStack.length;

        // 检查是否有循环引用的部分
        // 比如：
        // a = {foo: null};
        // a.foo = a;
        // console.log(a===a.foo); =>true
        // 如果是循环引用，那么在引用回原对象的时候，会检测到 aStack[length] ===a
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] === a) return bStack[length] === b;
        }
        // console.log(b);
        // Add the first object to the stack of traversed objects.
        // 每次递归都把那次递归的a,b push 进两个栈
        aStack.push(a);
        bStack.push(b);

        // Recursively compare objects and arrays.
        // 下面递归地判断数组和对象
        // 将嵌套的对象和数组展开
        // 如果 a 是数组
        // 因为嵌套，所以需要展开深度比较
        // a = { foo: { b: { foo: { c: { foo: null } } } } };
        // b = { foo: { b: { foo: { c: { foo: null } } } } };
        // a.foo.b.foo.c.foo = a;
        // b.foo.b.foo.c.foo = b;
        // console.log(eq(a, b)) => true
        if (areArrays) {
            // Compare array lengths to determine if a deep comparison is necessary.
            // 根据 length 判断是否应该继续递归对比
            length = a.length;

            // 如果 a 和 b length 属性大小不同
            // 那么显然 a 和 b 不同
            // return false 不用继续比较了
            if (length !== b.length) return false;

            // Deep compare the contents, ignoring non-numeric properties.
            // 递归比较数组中的每一项，忽略不可数的项
            while (length--) {


                if (!eq(a[length], b[length], aStack, bStack)) return false;
            }
        } else {
            // 如果 a 不是数组
            // 进入这个判断分支

            // Deep compare objects.
            // 两个对象的深度比较
            var keys = _.keys(a), key;
            length = keys.length;
            console.log(length);
            // Ensure that both objects contain the same number of properties before comparing deep equality.
            // a 和 b 对象的键数量不同
            if (_.keys(b).length !== length) return false;

            while (length--) {
                // Deep compare each member
                key = keys[length];
                // 如果b中也有这个key的话，递归比较
                if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
            }
        }

        // Remove the first object from the stack of traversed objects.
        // 与 aStack.push(a) 对应
        // 此时 aStack 栈顶元素正是 a
        // 而代码走到此步
        // a 和 b isEqual 确认
        // 所以 a，b 两个元素可以出栈
        aStack.pop();
        bStack.pop();

        return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    // 判断两个对象是否一样
    // new Boolean(true)，true 被认为 equal
    // [1, 2, 3], [1, 2, 3] 被认为 equal
    // 0 和 -0 被认为 unequal
    // NaN 和 NaN 被认为 equal
    _.isEqual = function(a, b) {
        return eq(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    // 是否是 {}、[] 或者 "" 或者 null、undefined
    _.isEmpty = function(obj) {
        if (obj == null) return true;

        // 如果是数组、类数组、或者字符串
        // 根据 length 属性判断是否为空
        // 后面的条件是为了过滤 isArrayLike 对于 {length: 10} 这样对象的判断 bug？
        if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;

        // 如果是对象
        // 根据 keys 数量判断是否为 Empty
        return _.keys(obj).length === 0;
    };


    // Is a given value a DOM element?
    // 判断是否为 DOM 元素节点，比如 p div 等
    _.isElement = function(obj) {
        // 确保 obj 不是 null, undefined 等假值
        // 并且 obj.nodeType === 1
        // !!用来将表达式强制转换为布尔类型的数据（boolean）
        return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    // 判断是否为数组
    _.isArray = nativeIsArray || function(obj) {
            return toString.call(obj) === '[object Array]';
        };

    // Is a given variable an object?
    // 判断是否为对象
    // 这里的对象包括 function 和 object,并且不包括空对象
    _.isObject = function(obj) {
        var type = typeof obj;
        //!!obj将obj转换成布尔类型，保证obj不是null
        // typeof null =>object
        return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    // 其他类型判断
    _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) === '[object ' + name + ']';
        };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    // _.isArguments 方法在 IE < 9 下的兼容
    // IE < 9 下对 arguments 调用 Object.prototype.toString.call 方法
    // 结果是 => [object Object]
    // 而并非我们期望的 [object Arguments]。
    // so 用是否含有 callee 属性来做兼容
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
            return _.has(obj, 'callee');
        };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    // 使用typeof 优化_.isFunction，同时兼容 old v8, IE 11 和 Safari 8
    // 只有在typeof /./ !=='function'&&typeof Int8Array !== 'object'的情况下使用typeof
    // 因为typeof的效率更高
    // typeof /s/ === 'function'; // Chrome 1-12 , 不符合 ECMAScript 5.1
    // typeof /s/ === 'object'; // Firefox 5+ , 符合 ECMAScript 5.1
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
        _.isFunction = function(obj) {
            // https://github.com/hanzichi/underscore-analysis/issues/31
            // 解释了为什么需要 ||false
            // 貌似是为了解决IE下的 JIT bug
            return typeof obj == 'function' || false;
        };
    }

    // Is a given object a finite number?
    // 判断是否是有限的数字
    _.isFinite = function(obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    // 判断是否是 NaN，NaN 是唯一的一个 `自己不等于自己` 的 number 类型
    // 最新版本（edge 版）已经修复该 BUG，如下
    _.isNaN = function(obj) {
        return _.isNumber(obj) && isNaN(obj);
    };
    // 下面的实现有bug的
    // _.isNaN(new Number(0)) => true
    // 详见 https://github.com/hanzichi/underscore-analysis/issues/13
    // _.isNaN = function(obj) {
    //     // console.log(_.isNumber(obj));
    //     // console.log(obj!==+obj);
    //     console.log(obj);
    //     console.log(+obj);
    //     return _.isNumber(obj) && obj !== +obj;
    // };

    // Is a given value a boolean?
    // 判断是否是布尔值
    // 基础类型（true、 false）
    // 以及 new Boolean() 两个方向判断
    // 有点多余了吧？
    // 个人觉得直接用 toString.call(obj) 来判断就可以了
    _.isBoolean = function(obj) {
        return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    // 判断是否是 null
    _.isNull = function(obj) {
        return obj === null;
    };

    // Is a given variable undefined?
    // 判断是否是 undefined
    // undefined 能被改写 （IE < 9）
    // undefined 只是全局对象的一个属性
    // 在局部环境能被重新定义
    // 但是「void 0」始终是 undefined
    _.isUndefined = function(obj) {
        return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    // 判断对象中是否有指定 key
    // own properties, not on a prototype
    _.has = function(obj, key) {
        // obj 不能为 null 或者 undefined
        return obj != null && hasOwnProperty.call(obj, key);
    };


    // Utility Functions
    // 工具类方法
    // 共 14 个扩展方法
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    // 如果全局环境中已经使用了 `_` 变量，放弃Underscore 的控制变量"_"。返回Underscore 对象的引用。
    // var underscore = _.noConflict();
    // underscore.each(..);
    // var previousUnderscore = root._
    _.noConflict = function() {
        //恢复原来的root._
        root._ = previousUnderscore;
        // _.noConflict()调用时，这里的this指向构造函数"_"
        // 为什么指向构造函数呢
        // 因为他们都是构造函数上的属性
        return this;
    };

    // Keep the identity function around for default iteratees.
    // 返回传入的参数，看起来好像没什么卵用
    // 其实 _.identity 在 undescore 内大量作为迭代函数出现
    // 能简化很多迭代函数的书写
    _.identity = function(value) {
        return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    // 创建一个函数，这个函数 返回相同的值
    // var stooge = {name: 'moe'};
    //     stooge === _.constant(stooge)();
    // => true
    _.constant = function(value) {
        return function() {
            return value;
        };
    };

    _.noop = function(){};

    // 传送门
    /*
     var property = function(key) {
     return function(obj) {
     return obj == null ? void 0 : obj[key];
     };
     };
     */
    _.property = property;

    // Generates a function for a given object that returns a given property.
    _.propertyOf = function(obj) {
        return obj == null ? function(){} : function(key) {
                return obj[key];
            };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    // 判断一个给定的对象是否包含所有attrs
    //_.matcher(attrs)与_.isMatch(obj, attrs)类似，不同的是_.matcher(attrs)返回一个函数，需要进一步传入object，才能返回布尔值
    //而_.isMatch(obj, attrs)直接返回布尔值
    _.matcher = _.matches = function(attrs) {
        attrs = _.extendOwn({}, attrs);
        return function(obj) {
            // _.isMatch(object, attrs)判断 object 对象中是否有 attrs 中的所有 key-value 键值对，
            // object的键值对是否包含attrs的键值对
            // 返回布尔值
            return _.isMatch(obj, attrs);
        };
    };

    // Run a function **n** times.
    // 调用给定的迭代函数n次,每一次调用iteratee传递index参数。生成一个返回值的数组。
    _.times = function(n, iteratee, context) {
        //accum>=0
        var accum = Array(Math.max(0, n));
        iteratee = optimizeCb(iteratee, context, 1);
        for (var i = 0; i < n; i++)
            accum[i] = iteratee(i);
        return accum;
    };

    // Return a random integer between min and max (inclusive).
    // I don't think we do want to "support" this case,
    // 这个函数在你传入浮点数的时候会返回浮点数，作者作出如下解释：
    // because the function is supposed to work with integers.
    // If we were returning a random float between min and max, this would be different.
    // Instead, you can round before you call random
    // 传入两个参数的情况下返回一个 [min, max]范围内的任意整数
    // 如果只有一个参数，则返回一个[0,min]范围的整数
    _.random = function(min, max) {
        if (max == null) {
            max = min;
            min = 0;
        }
        //由于这里 (max - min + 1)，所以可以取到最大值
        //如果是(max - min)的话，就不能取到最大值，[min,max)
        return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    // 返回当前时间的整数 "时间戳"（单位 ms）
    // _.now();
    // => 1392066795351
    _.now = Date.now || function() {
            return new Date().getTime();
        };

    // List of HTML entities for escaping.
    // HTML 实体编码
    // escapeMap 用于编码
    // see @http://www.cnblogs.com/zichi/p/5135636.html
    // in PHP, htmlspecialchars — Convert special characters to HTML entities
    // see @http://php.net/manual/zh/function.htmlspecialchars.php
    // 能将 & " ' < > 转为实体编码（下面的前 5 种）
    var escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        // 以上四个为最常用的字符实体
        // 也是仅有的可以在所有环境下使用的实体字符（其他应该用「实体数字」，如下）
        // 浏览器也许并不支持所有实体名称（对实体数字的支持却很好）
        "'": '&#x27;',
        '`': '&#x60;'
    };

    // _.invert 方法将一个对象的键值对对调
    // unescapeMap 用于解码
    var unescapeMap = _.invert(escapeMap);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper = function(map) {
        var escaper = function(match) {
            return map[match];
        };
        // Regexes for identifying a key that needs to be escaped
        // 正则替换
        // 注意下 ?:
        var source = '(?:' + _.keys(map).join('|') + ')';
        // source=> (?:&|<|>|"|'|`)
        // 正则 pattern
        var testRegexp = RegExp(source);
        // testRegexp => /(?:&|<|>|"|'|`)/
        // 全局替换
        var replaceRegexp = RegExp(source, 'g');
        // replaceRegexp => /(?:&|<|>|"|'|`)/g

        return function(string) {
            string = string == null ? '' : '' + string;
            return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    };

    // Escapes a string for insertion into HTML, replacing &, <, >, ", `, and ' characters.
    // 编码，防止被 XSS 攻击等一些安全隐患
    _.escape = createEscaper(escapeMap);

    // The opposite of escape
    // replaces &amp;, &lt;, &gt;, &quot;, &#96; and &#x27; with their unescaped counterparts
    // 解码
    _.unescape = createEscaper(unescapeMap);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    // 如果指定的property 的值是一个函数，那么将在object上下文内调用它;否则，返回它。
    // 如果提供默认值，并且属性不存在，那么默认值将被返回。如果设置defaultValue是一个函数，它的结果将被返回。
    _.result = function(object, property, fallback) {
        var value = object == null ? void 0 : object[property];
        if (value === void 0) {
            value = fallback;
        }
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    // 生成客户端临时的 DOM ids
    var idCounter = 0;
    _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    // ERB => Embedded Ruby
    // Underscore 默认采用 ERB-style 风格模板，也可以根据自己习惯自定义模板
    // 1. <%  %> - to execute some code
    // 2. <%= %> - to print some value in template
    // 3. <%- %> - to print some values HTML escaped
    _.templateSettings = {
        // 三种渲染模板
        // 执行
        evaluate    : /<%([\s\S]+?)%>/g,
        // 插入
        interpolate : /<%=([\s\S]+?)%>/g,
        // 编码
        escape      : /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
        "'":      "'",
        '\\':     '\\',
        '\r':     'r',  // 回车符
        '\n':     'n',  // 换行符
        // http://stackoverflow.com/questions/16686687/json-stringify-and-u2028-u2029-check
        '\u2028': 'u2028', // Line separator 行分隔符
        '\u2029': 'u2029'  // Paragraph separator  段落分隔符
    };

    // RegExp pattern
    var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

    // 转义字符
    var escapeChar = function(match) {
        /**
         '      => \\'
         \\     => \\\\
         \r     => \\r
         \n     => \\n
         \u2028 => \\u2028
         \u2029 => \\u2029
         **/
        return '\\' + escapes[match];
    };

    // 将 JavaScript 模板编译为可以用于页面呈现的函数
    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    // NB: `oldSettings` only exists for backwards compatibility.
    // oldSettings 参数为了兼容 underscore 旧版本
    // setting 参数可以用来自定义字符串模板（但是 key 要和 _.templateSettings 中的相同，才能覆盖）
    // 1. <%  %> - to execute some code
    // 2. <%= %> - to print some value in template
    // 3. <%- %> - to print some values HTML escaped
    // Compiles JavaScript templates into functions
    // _.template(templateString, [settings])
    // var compiled = _.template("hello: <%= name %>");
    //     compiled({name: 'moe'});
    // => "hello: moe"
    //
    //     var template = _.template("<b><%- value %></b>");
    //     template({value: '<script>'});
    // => "<b>&lt;script&gt;</b>"

    // var settings = {
    //     interpolate: /\{\{(.+?)\}\}/g  // 会覆盖_.templateSettings.interpolate
    // };
    // var template = _.template("Hello {{ name }}!", settings);//通过settings传入规则
    _.template = function(text, settings, oldSettings) {
        // 兼容旧版本
        if (!settings && oldSettings)
            settings = oldSettings;

        // 相同的 key，优先选择 settings 对象中的
        // 其次选择 _.templateSettings 对象中的
        // 生成最终用来做模板渲染的字符串
        // 自定义模板优先于默认模板 _.templateSettings
        // 如果定义了相同的 key，则前者会覆盖后者
        settings = _.defaults({}, settings, _.templateSettings);

        // Combine delimiters into one regular expression via alternation.
        // 正则表达式 pattern，用于正则匹配 text 字符串中的模板字符串
        // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|<%([\s\S]+?)%>|$/g
        // 注意最后还有个 |$
        var matcher = RegExp([
                // 注意下 pattern 的 source 属性
                (settings.escape || noMatch).source,
                (settings.interpolate || noMatch).source,
                (settings.evaluate || noMatch).source
            ].join('|') + '|$', 'g');

        // Compile the template source, escaping string literals appropriately.
        // 编译模板字符串，将原始的模板字符串替换成函数字符串
        // 用拼接成的函数字符串生成函数（new Function(...)）
        var index = 0;

        // source 变量拼接的字符串用来生成函数
        // 用于当做 new Function 生成函数时的函数字符串变量
        // 记录编译成的函数字符串，可通过 _.template(tpl).source 获取（_.template(tpl) 返回方法）
        var source = "__p+='";

        // replace 函数不需要为返回值赋值，主要是为了在函数内对 source 变量赋值
        // 将 text 变量中的模板提取出来
        // match 为匹配的整个串
        // escape/interpolate/evaluate 为匹配的子表达式（如果没有匹配成功则为 undefined）
        // offset 为字符匹配（match）的起始位置（偏移量）
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
            // \n => \\n
            source += text.slice(index, offset).replace(escaper, escapeChar);
            // 改变 index 值，为了下次的 slice
            index = offset + match.length;

            if (escape) {
                // 需要对变量进行编码（=> HTML 实体编码）
                // 避免 XSS 攻击
                source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
            } else if (interpolate) {
                // 单纯的插入变量
                source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
            } else if (evaluate) {
                // 可以直接执行的 JavaScript 语句
                // 注意 "__p+="，__p 为渲染返回的字符串
                source += "';\n" + evaluate + "\n__p+='";
            }
            // Adobe VMs need the match returned to produce the correct offset.
            // return 的作用是？
            // 将匹配到的内容原样返回（Adobe VMs 需要返回 match 来使得 offset 值正常）
            return match;
        });

        source += "';\n";
        // By default, `template` places the values from your data in the local scope via the `with` statement.
        // However, you can specify a single variable name with the variable setting.
        // This can significantly improve the speed at which a template is able to render.
        // If a variable is not specified, place data values in local scope.
        // 指定 scope
        // 如果设置了 settings.variable，能显著提升模板的渲染速度
        // 否则，默认用 with 语句指定作用域
        if (!settings.variable)
            source = 'with(obj||{}){\n' + source + '}\n';

        // 增加 print 功能
        // __p 为返回的字符串
        source = "var __t,__p='',__j=Array.prototype.join," +
            "print=function(){__p+=__j.call(arguments,'');};\n" +
            source + 'return __p;\n';

        try {
            // render 方法，前两个参数为 render 方法的参数
            // obj 为传入的 JSON 对象，传入 _ 参数使得函数内部能用 Underscore 的函数
            var render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
            // 抛出错误
            e.source = source;
            throw e;
        }

        // 返回的函数
        // data 一般是 JSON 数据，用来渲染模板
        var template = function(data) {
            // render 为模板渲染函数
            // 传入参数 _ ，使得模板里 <%  %> 里的代码能用 underscore 的方法
            //（<%  %> - to execute some code）
            return render.call(this, data, _);
        };

        // Provide the compiled source as a convenience for precompilation.
        // template.source for debug?
        // obj 与 with(obj||{}) 中的 obj 对应
        var argument = settings.variable || 'obj';

        // 可通过 _.template(tpl).source 获取
        // 可以用来预编译，在服务端预编译好，直接在客户端生成代码，客户端直接调用方法
        // 这样如果出错就能打印出错行
        // Precompiling your templates can be a big help when debugging errors you can't reproduce.
        // This is because precompiled templates can provide line numbers and a stack trace,
        // something that is not possible when compiling templates on the client.
        // The source property is available on the compiled template function for easy precompilation.
        // see @http://stackoverflow.com/questions/18755292/underscore-js-precompiled-templates-using
        // see @http://stackoverflow.com/questions/13536262/what-is-javascript-template-precompiling
        // see @http://stackoverflow.com/questions/40126223/can-anyone-explain-underscores-precompilation-in-template
        // JST is a server-side thing, not client-side.
        // This mean that you compile Unserscore template on server side by some server-side script and save the result in a file.
        // Then use this file as compiled Unserscore template.
        template.source = 'function(' + argument + '){\n' + source + '}';

        return template;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    // 使支持链式调用
    /**
     // 非 OOP 调用 chain
     _.chain([1, 2, 3])
     .map(function(a) { return a * 2; })
     .reverse().value(); // [6, 4, 2]
     // OOP 调用 chain
     _([1, 2, 3])
     .chain()
     .map(function(a){ return a * 2; })
     .first()
     .value(); // 2
     **/
    _.chain = function(obj) {
        // 无论是否 OOP 调用，都会转为 OOP 形式
        // 并且给新的构造对象添加了一个 _chain 属性
        var instance = _(obj);

        // 标记是否使用链式操作
        instance._chain = true;

        // 返回 OOP 对象
        // 可以看到该 instance 对象除了多了个 _chain 属性
        // 其他的和直接 _(obj) 的结果一样
        return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // OOP
    // 如果 `_` 被当做方法（构造函数）调用, 则返回一个被包装过的对象
    // 该对象能使用 underscore 的所有方法
    // 并且支持链式调用

    // Helper function to continue chaining intermediate results.
    // 一个帮助方法（Helper function）
    var result = function(instance, obj) {
        // 如果需要链式操作，则对 obj 运行 _.chain 方法，使得可以继续后续的链式操作
        // 如果不需要，直接返回 obj
        return instance._chain ? _(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    // 可向 underscore 函数库扩展自己的方法
    // obj 参数必须是一个对象（JavaScript 中一切皆对象）
    // 且自己的方法定义在 obj 的属性上
    // 如 obj.myFunc = function() {...}
    // 形如 {myFunc: function(){}}
    // 之后便可使用如下: _.myFunc(..) 或者 OOP _(..).myFunc(..)
    _.mixin = function(obj) {
        // 遍历 obj 的 key，将方法挂载到 Underscore 上
        // 其实是将方法浅拷贝到 _.prototype 上
        _.each(_.functions(obj), function(name) {
            // 直接把方法挂载到 _[name] 上
            // 调用类似 _.myFunc([1, 2, 3], ..)
            var func = _[name] = obj[name];

            // 浅拷贝
            // 将 name 方法挂载到 _ 对象的原型链上，使之能 OOP 调用
            _.prototype[name] = function() {
                // 第一个参数
                var args = [this._wrapped];

                // arguments 为 name 方法需要的其他参数
                push.apply(args, arguments);
                // 执行 func 方法
                // 支持链式操作
                return result(this, func.apply(_, args));
            };
        });
    };

    // Add all of the Underscore functions to the wrapper object.
    // 将前面定义的 underscore 方法添加给包装过的对象
    // 即添加到 _.prototype 中
    // 使 underscore 支持面向对象形式的调用
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    // 将 Array 原型链上有的方法都添加到 underscore 中
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            var obj = this._wrapped;
            method.apply(obj, arguments);

            if ((name === 'shift' || name === 'splice') && obj.length === 0)
                delete obj[0];

            // 支持链式操作
            return result(this, obj);
        };
    });

    // Add all accessor Array functions to the wrapper.
    // 添加 concat、join、slice 等数组原生方法给 Underscore
    _.each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            return result(this, method.apply(this._wrapped, arguments));
        };
    });

    // Extracts the result from a wrapped and chained object.
    // 一个包装过(OOP)并且链式调用的对象
    // 用 value 方法获取结果
    // _(obj).value === obj?
    _.prototype.value = function() {
        return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

    _.prototype.toString = function() {
        return '' + this._wrapped;
    };

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, underscore registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party lib, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    // 兼容 AMD 规范
    if (typeof define === 'function' && define.amd) {
        define('underscore', [], function() {
            return _;
        });
    }
}.call(this));