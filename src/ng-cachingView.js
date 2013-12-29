

angular.module('ngCachingView',[])
.directive('ngCachingView', ngCachingViewFactory);

ngCachingViewFactory.$inject = ['$cacheFactory', '$route', '$anchorScroll', '$compile', '$controller', '$animate'];
function ngCachingViewFactory( $cacheFactory,  $route,   $anchorScroll,   $compile,   $controller,   $animate) {
  return {
    restrict: 'ECA',
    terminal: true,
    priority: 400,
    transclude: 'element',
    compile: function(element, attr, linker) {
      return function(scope, $element, attr) {
        var currentScope,
            currentElement,
            onloadExp = attr.onload || '';

        var viewCache = $cacheFactory('viewCache');
        scope.$on('$routeChangeSuccess', update);
        update();

        function disconnectScope(scope){
            var parent = scope.$parent;
            scope.$$disconnected = true;
            // See Scope.$destroy
            if (parent.$$childHead === scope) {
                parent.$$childHead = scope.$$nextSibling;
            }
            if (parent.$$childTail === scope) {
                parent.$$childTail = scope.$$prevSibling;
            }
            if (scope.$$prevSibling) {
                scope.$$prevSibling.$$nextSibling = scope.$$nextSibling;
            }
            if (scope.$$nextSibling) {
                scope.$$nextSibling.$$prevSibling = scope.$$prevSibling;
            }
            scope.$$nextSibling = scope.$$prevSibling = null;

            scope.$broadcast('$disconnected');

        }
        function reconnectScope(scope){
            var child = scope;
            if (!child.$$disconnected) {
                return;
            }
            var parent = child.$parent;
            child.$$disconnected = false;
            // See Scope.$new for this logic...
            child.$$prevSibling = parent.$$childTail;
            if (parent.$$childHead) {
                parent.$$childTail.$$nextSibling = child;
                parent.$$childTail = child;
            } else {
                parent.$$childHead = parent.$$childTail = child;
            }

            scope.$broadcast('$reconnected');

        }

        function cleanupLastView() {
          if (currentScope) {
            disconnectScope(currentScope);
            currentScope = null;
          }
          if(currentElement) {
            $animate.leave(currentElement);
            currentElement = null;
          }
        }

        function update() {
          var locals = $route.current && $route.current.locals,
              template = locals && locals.$template;

          var url = $route.current && $route.current.templateUrl;
          var view = null;
          if (url){
              view = viewCache.get(url);
              if (view){
                  cleanupLastView();
                  $animate.enter(view, null, $element);
                  currentElement = view;
                  currentScope = view.scope();
                  reconnectScope(currentScope);
                  return;
              }
          }

          if (template) {
            var newScope = scope.$new();
            linker(newScope, function(clone) {
              cleanupLastView();

              clone.html(template);
              $animate.enter(clone, null, $element);

              var link = $compile(clone.contents()),
                  current = $route.current;

              currentScope = current.scope = newScope;
              currentElement = clone;
              currentElement.remove = function(){
//                  this[0].remove();
                  var i, node, parent;
                  for (i = 0; i < this.length; i++) {
                      node = this[i];
                      parent = node.parentNode;
                      if (parent) {
                          parent.removeChild(node);
                      }
                  }
              };


              if (current.controller) {
                locals.$scope = currentScope;
                var controller = $controller(current.controller, locals);
                currentScope.$$controller = controller;
                clone.data('$ngControllerController', controller);
                clone.children().data('$ngControllerController', controller);
              }

              link(currentScope);
              currentScope.$emit('$viewContentLoaded');
              currentScope.$eval(onloadExp);

              if (url){
                  viewCache.put(url, clone);
              }

              // $anchorScroll might listen on event...
              $anchorScroll();
            });
          } else {
            cleanupLastView();
          }
        }
      };
    }
  };
}
