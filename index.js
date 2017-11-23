// jshint esversion: 6
// jshint laxbreak:  true
// jshint laxcomma:  true

var sum = function (arr) {
  return arr.reduce(function (acc, x) { return acc + x; }, 0);
};

//Tokenizing
var makeTokens = function (text) {
  if (text === null) { return []; }
  if (text.length === 0) { return []; }
  return text.toLowerCase().replace(
      /[~`’!@#$%^&*(){}\[\];:"'<,.>?\/\\|_+=-]/g
    , ''
  ).split(' ').filter(function (token) { return token.length > 0; });
};


var makeTfVector = function (countVector) {
  let total = sum(countVector);
  return countVector.map(
    function (count) {
      return total === 0 ? 0 : count / total;
    }
  );
};


var app = new Vue({
    el: "#app"
  , data: {
        docs: [
        ]
      , query: null
    }
  , methods: {
        addDoc: function () {
          this.docs.push({text: "", id: Date.now()});
          this.$nextTick(
            this.docsNavSetup
          );
        }
      ,  removeDoc: function (button) {
          let id = parseInt(button.target.attributes.docId.value, 10);
          this.docs = this.docs.filter(
            function (doc) {
              return (doc.id !== id);
            }
          );
        }
      , rankScoredDocs: function (scores) {
          return scores.map(
            function (score, index) {
              let doc = this.docs[index];
              doc.index = index;
              return [score, doc];
            }.bind(this)
          ).sort(function (a, b) { return -a[0] + b[0]; }).map(
            function (elem) {
              return elem[1];
            }
          );
        }
      , docsNavSetup: function () {
          this.docs.map(
            function (doc, index, docs) {
              let el = document.getElementById(doc.id.toString());
              if (el === null) { return; }
              el.tabIndex = (index + 1).toString();
              if (index === (docs.length - 1)) {
                el.focus();
              } else {
                el.blur();
              }
            }
          );
        }
    }
  , computed: {
        parsedDocs: function () {
          return this.docs.map(
            function (doc) {
              return {
                  tokens: makeTokens(doc.text)
                , id: doc.id
              };
            }
          );
        }
      , tokens: function () {
          return this.parsedDocs.map(
              function (parsedDoc) { return parsedDoc.tokens || []; }
          );
        }
      , dictionary: function () {
          return this.tokens.reduce(
              function (acc, tokens) {
                return acc.concat(tokens);
              }
            , []
          ).reduce(
              function (acc, word) {
                if (acc.indexOf(word) === -1) {
                  acc.push(word);
                  return acc;
                } else {
                  return acc;
                }
              }
            , []
          ).sort();
        }
      , numberOfDocs: function () {
          return this.countVectors.reduce(
              function (acc, x, index) {
                return acc + (this.countVectors[index].length === 0 ? 0 : 1);
              }.bind(this)
            , 0
          );
        }
      , countVectors: function () {
          return this.tokens.map(
            function (tokens) {
              return this.dictionary.map(
                function (word) {
                  return tokens.reduce(
                      function (acc, token) { return token === word ? acc + 1 : acc; }
                    , 0
                  );
                }
              );
            }.bind(this)
          );
        }
      , countVectorsT: function () {
          let arr = [];
          this.countVectors.map(
            function (countVector, row, countVectors) {
              countVector.map(
                function (count, col, countVector) {
                  if (row === 0) { arr.push([]); }
                  arr[col].push(count);
                }
              );
            }
          );
          return arr;
        }
      , tfVectors: function () {
          return this.countVectors.map(
            function (countVector) {
              return makeTfVector(countVector);
            }
          );
        }
      , idfVectors: function () {
          let total = this.numberOfDocs;
          if (total === 0) { return this.countVectors.map(function () { return []; }); }
          let idfVector = this.countVectors[0].map(
            function (count, col) {
              let inDocCount = this.countVectorsT[col].reduce(
                  function (acc, x) {
                    return acc + (x > 0 ? 1 : 0);
                  }
                , 0
              );
              if (total === 0) { return 0; }
              if (inDocCount === 0) { return 0; }
              return Math.log(total / inDocCount);
            }.bind(this)
          );
          return this.countVectors.map(function () { return idfVector; });
        }
      , tfIdfVectors: function () {
          return this.tfVectors.map(
            function (tfVector, row) {
              return tfVector.map(
                function (tf, col) {
                  return tf * this.idfVectors[row][col];
                }.bind(this)
              );
            }.bind(this)
          );
        }
      , docsVectors: function () {
          return this.countVectors.map(
            function (countVector, index) {
              return [countVector, this.tfVectors[index], this.idfVectors[index], this.tfIdfVectors[index]];
            }.bind(this)
          );
        }
      , queryTokens: function () {
          return makeTokens(this.query);
        }
      , queryCountVector: function () {
          return this.dictionary.map(
            function (word) {
              return this.queryTokens.reduce(
                  function (acc, token) { return token === word ? acc + 1 : acc; }
                , 0
              );
            }.bind(this)
          );
        }
      , queryTfVector: function () {
          return makeTfVector(this.queryCountVector);
        }
      , queryIdfVector: function () {
          return this.idfVectors[0];
        }
      , queryTfIdfVector: function () {
          return this.queryTfVector.map(
            function (tf, index) {
              return tf * this.queryIdfVector[index];
            }.bind(this)
          );
        }
      , cosineSimilarities: function () {
          let mag = function (vector) {
            return Math.sqrt(
              vector.reduce(
                  function (acc, el) {
                    return acc + (el * el);
                  }
                , 0
              )
            );
          };
          let queryMag = mag(this.queryTfIdfVector);
          return this.tfIdfVectors.map(
            function (tfIdfVector) {
              let dot = tfIdfVector.reduce(
                  function (acc, tfIdf, index) {
                    return acc + (tfIdf * this.queryTfIdfVector[index]);
                  }.bind(this)
                , 0
              );
              let docMag = mag(tfIdfVector);
              let mags = queryMag * docMag;
              return mags === 0 ? 0 : dot / mags;
            }.bind(this)
          );
        }
      , tfIdfVsmRankedDocs: function () {
          return this.rankScoredDocs(this.cosineSimilarities);
        }
    }
});