

angular.module('ngCachingView',['Service'])
.directive('ngCachingView', ngCachingViewFactory)
.directive('ngCachingView', ngViewFillContentFactory) ;

ngCachingViewFactory.$inject = ['$cacheFactory', '$route', '$animate', 'Nav'];
function ngCachingViewFactory( $cacheFactory,  $route,   $animate, Nav) {
  return {
    restrict: 'ECA',
    terminal: true,
    priority: 400,
    transclude: 'element',
    link:  function(scope, $element, attr, ctrl, $transclude) {
        var currentScope,
            currentElement,
            currentUrl,
            autoScrollExp = attr.autoscroll,
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

        Nav.push($element);
        function changeView(view){

          if (currentElement){

              oldIndex = currentElement.data('$zIndex') || 0;
              newIndex = view.data('$zIndex') || 0;

              //Stack the current view
              if(newIndex > oldIndex){
                $animate.addClass(currentElement, 'stacked');
                Nav.push(currentElement);
                $animate.enter(view, null, currentElement);
              }
              else{
                backView = Nav.pop();
                //Replace current view, stacked view unchanged
                if (backView !== view){
                    Nav.push(backView);
                    backView.after(view);
                }
                //Remove current view and pop up stacked view
                else{
                    $animate.removeClass(view, 'stacked');
                }
                //Always remove current view
                cleanupLastView();
              }
          }
          else{
              $element.after(view);
          }
          currentElement = view;
          Nav.set(view);
        }

        function update() {

          //console.log($route);
          //window.$route = $route;

          var locals = $route.current && $route.current.locals,
              template = locals && locals.$template;

          var url = $route.current && $route.current.templateUrl;
          var view = null;
          // Same url change
          if (url == currentUrl && currentScope){
              if (!angular.equals(currentScope.$param, $route.current.params)){
                  currentScope.$param = $route.current.params;
                  currentScope.$broadcast('$scopeUpdate');
              }
              return;
          }
          currentUrl = url;

          if (url){
              view = viewCache.get(url);
              if (view){
                  changeView(view);
                  currentScope = view.scope();
                  reconnectScope(currentScope);
                  if (!angular.equals(currentScope.$param, $route.current.params)){
                    currentScope.$param = $route.current.params;
                    currentScope.$broadcast('$scopeUpdate');
                  }
                  currentScope.$emit('$viewContentLoaded');
                  return;
              }
          }

          if (angular.isDefined(template)) {
              var newScope = scope.$new();
              var current = $route.current;
              // Note: This will also link all children of ng-view that were contained in the original
              // html. If that content contains controllers, ... they could pollute/change the scope.
              // However, using ng-view on an element with additional content does not make sense...
              // Note: We can't remove them in the cloneAttchFn of $transclude as that
              // function is called before linking the content, which would apply child
              // directives to non existing elements.
              var clone = $transclude(newScope, function(clone) {});

              changeView(clone);
              //To avoid scope be detached from element
              clone.remove = function(){
                  var i, node, parent;
                  for (i = 0; i < this.length; i++) {
                      node = this[i];
                      parent = node.parentNode;
                      if (parent) {
                          parent.removeChild(node);
                      }
                  }
              };
              currentScope = current.scope = newScope;
              currentScope.$param = current.params;
              currentScope.$broadcast('$scopeUpdate');
              currentScope.$emit('$viewContentLoaded');
              currentScope.$eval(onloadExp);

              if (url){
                  viewCache.put(url, clone);
              }

          } else {
            cleanupLastView();
          }
        }
      }
  };
}


// This directive is called during the $transclude call of the first `ngView` directive.
// It will replace and compile the content of the element with the loaded template.
// We need this directive so that the element content is already filled when
// the link function of another directive on the same element as ngView
// is called.
ngViewFillContentFactory.$inject = ['$compile', '$controller', '$route'];
function ngViewFillContentFactory($compile, $controller, $route) {
    return {
        restrict: 'ECA',
        priority: -400,
        link: function(scope, $element) {
            var current = $route.current,
                locals = current.locals;

            $element.html(locals.$template);

            var link = $compile($element.contents());


            if(current.zIndex){
                $element.data('$zIndex', Number(current.zIndex));
                $element.data('$templateUrl', current.templateUrl);
            }

            if (current.controller) {
                locals.$scope = scope;
                var controller = $controller(current.controller, locals);
                if (current.controllerAs) {
                    scope[current.controllerAs] = controller;
                }
                $element.data('$ngControllerController', controller);
                $element.children().data('$ngControllerController', controller);
            }

            link(scope);
        }
    };
}