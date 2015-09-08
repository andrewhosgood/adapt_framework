define(
  [
    'coreJS/adapt',
    'coreViews/questionView',
    'handlebars'
  ],
  function( Adapt, QuestionView, Handlebars ) {
    var Slider = QuestionView.extend(
      {
        events: {
          'click .slider-scale-number': 'onItemSelected',
          'click .slider-bar-number': 'onItemSelected',
          'focus .slider-handle': 'onHandleFocus',
          'blur .slider-handle': 'onHandleBlur'
        },

        resetQuestionOnRevisit: function() {
          this.disableQuestion();
          this.deselectAllItems();
          this.resetQuestion();
        },

        setupQuestion: function() {
          var theRealThis = this;

          if( !this.model.get( '_items' ) ) {
            this.setupModelItems();
          }

          Handlebars.registerHelper( 'sliderPosition',
            function( intIndex ) {
              return ( intIndex / ( theRealThis.model.get( '_items' ).length - 1 ) ) * 100;
            }
          );

          this.restoreUserAnswers();
        },

        onQuestionRendered: function() {
          this.$sliderHandle = this.$el.find( '.slider-handle' );
          this.$sliderBarIndicator = this.$el.find( '.slider-bar-indicator' );
          this.$sliderWidget = this.$el.find( '.slider-widget' );
          this.$sliderScaleNumbers = this.$el.find( '.slider-scale-numbers' );
          this.setupDragables();
          this.setReadyStatus();
        },

        setupModelItems: function() {
          var arrItems = [],
              intAnswer = this.model.get( '_correctAnswer' ) || '',
              objRange = this.model.get( '_correctRange' ) || {},
              intStart = this.model.get( '_scaleStart' ),
              intEnd = this.model.get( '_scaleEnd' ),
              intStep = this.model.get( '_scaleStep' ) || 1;

          for( var intItemValue = intStart, intItem = 0; intItemValue <= intEnd; intItemValue += intStep, intItem++ ) {
            var blCorrect = ( ( intAnswer !== '' ) ? ( intItemValue == intAnswer ) : ( intItemValue >= objRange._bottom && intItemValue <= objRange._top ) );
            arrItems.push(
              {
                index: intItem,
                value: intItemValue,
                selected: false,
                correct: blCorrect
              }
            );
          }

          this.model.set( '_items', arrItems );
        },

        destroyDragables: function() {
          if( this.$sliderHandle ) {
            this.$sliderHandle.off( 'mousedown touchstart' );
          }
        },

        setupDragables: function() {
          this.destroyDragables();
          this.$sliderHandle.off( 'mousedown touchstart' ).on( 'mousedown touchstart', _.bind( this.onStartDrag, this ) );
        },

        onStartDrag: function( e ) {
          this.$sliderHandle.stop( true ).addClass( 'dragging' ),
          $( '#wrapper' ).on( 'mousemove touchmove', _.bind( this.doPointerMove, this ) ).one( 'mouseup touchend', _.bind( this.onEndDrag, this ) );
        },

        onEndDrag: function( e ) {
          $( '#wrapper' ).off( 'mousemove touchmove' ),
          this.$sliderHandle.removeClass( 'dragging' );
          this.resolveToClosestItem( e );
        },

        onHandleFocus: function( e ) {
          e.preventDefault();
          this.$sliderHandle.on( 'keydown', _.bind( this.onKeyDown, this ) );
        },

        onHandleBlur: function( e ) {
          e.preventDefault();
          this.$sliderHandle.off( 'keydown' );
        },

        onKeyDown: function( e ) {
          var intKey = e.which;

          // Tab
          if( intKey != 9 ) {
            e.preventDefault();

            var intCurrentSelectedItem = this.getSelectedItemIndex();

            switch( intKey ) {
              case 40: // Down
              case 37: // Left
                intCurrentSelectedItem--;
                break;

              case 38: // Up
              case 39: // Right
                intCurrentSelectedItem++;
                break;
            }

            if( intCurrentSelectedItem < 0 ) {
              intCurrentSelectedItem = 0;
            } else if( intCurrentSelectedItem >= this.model.get( '_items' ).length ) {
              intCurrentSelectedItem = this.model.get( '_items' ).length - 1;
            }

            this.selectItem( intCurrentSelectedItem );
            this.animateToSelectedItem();
            this.setHandleItemText( intCurrentSelectedItem );
          }
        },

        onItemSelected: function( e ) {
          e.preventDefault();

          if( !this.model.get( '_isComplete' )
              && !this.$sliderWidget.hasClass( 'disabled' ) ) {
            var intItemIndex = $( e.currentTarget ).attr( 'data-index' );

            this.selectItem( intItemIndex );
            this.animateToSelectedItem();
            this.setHandleItemText( intItemIndex );
          }
        },

        getPercentageAlongBar: function( intPointerXPosition ) {
          var intBarLeftmostPoint = this.$el.find( '.slider-bar' ).offset().left,
              intBarWidth = this.$el.find( '.slider-bar' ).width(),
              intBarRightmostPoint = intBarLeftmostPoint + intBarWidth;

          if( intPointerXPosition > intBarRightmostPoint ) {
            intPointerXPosition = intBarRightmostPoint;
          } else if( intPointerXPosition < intBarLeftmostPoint ) {
            intPointerXPosition = intBarLeftmostPoint;
          }

          intPointerXPosition -= intBarLeftmostPoint;

          return ( intPointerXPosition / intBarWidth ) * 100;
        },

        doPointerMove: function( e ) {
          e.preventDefault();
          e.stopPropagation();

          var intPointerXPosition = e.originalEvent.touches ? e.originalEvent.touches[0].pageX : e.pageX;

          this.lastPointerXPosition = intPointerXPosition;
          this.$sliderHandle.css( 'left', this.getPercentageAlongBar( intPointerXPosition ) + '%' );
          this.setHandleItemText( this.getClosestItemIndex( e ) );

          return false;
        },

        getPercentagePerItem: function() {
          return 100 / ( this.model.get( '_items' ).length - 1 );
        },

        getClosestItemIndex: function( e ) {
          var intPointerXPosition;

          if( e.originalEvent.touches
              && e.originalEvent.touches[0] ) {
            intPointerXPosition = e.originalEvent.touches[0].pageX;
          } else {
            intPointerXPosition = e.pageX || this.lastPointerXPosition;
          }

          var fltCurrentPercentage = this.getPercentageAlongBar( intPointerXPosition ),
              fltPercentagePerItem = this.getPercentagePerItem(),
              fltRemainder = fltCurrentPercentage % fltPercentagePerItem,
              fltItem = fltCurrentPercentage / fltPercentagePerItem,
              intClosestItem = ( fltRemainder > ( fltPercentagePerItem / 2 ) ) ? Math.ceil( fltItem ) : Math.floor( fltItem );

          return intClosestItem;
        },

        resolveToClosestItem: function( e ) {
          this.selectItem( this.getClosestItemIndex( e ) );
          this.animateToSelectedItem();
        },

        selectItem: function( intSelectedItem ) {
          var objItems = this.model.get( '_items' );

          _.each(
            objItems,
            function( objItem, intIndex ) {
              objItems[intIndex].selected = ( objItem.index === intSelectedItem );
            },
            this
          );
          
          this.model.set( '_items', objItems );
          this.model.set( '_selectedItem', this.model.get( '_items' )[intSelectedItem] );

          if( this.$sliderScaleNumbers ) {
            this.$sliderScaleNumbers.children( '.slider-scale-number[data-index="' + intSelectedItem + '"]' ).addClass( 'user-answer' ).siblings().removeClass( 'user-answer' );
          }

          this.setHandleItemText( intSelectedItem );
        },

        setHandleItemText: function( intItem ) {
          var intLabel = ( intItem ? this.model.get( '_items' )[intItem].value : this.model.get( '_selectedItem' ).value );

          this.setHandleText( intLabel + ( this.model.get( '_scaleLabel' ) || '' ) );
        },

        setHandleText: function( strText, blHalfSize ) {
          if( this.$sliderHandle ) {
            this.$sliderHandle.attr(
              {
                'data-value': strText,
                'aria-valuenow': strText
              }
            );

            if( blHalfSize === true ) {
              this.$sliderHandle.addClass( 'half-size' );
            } else {
              this.$sliderHandle.removeClass( 'half-size' );
            }
          }
        },

        getSelectedItemIndex: function() {
          return this.model.get( '_selectedItem' ).index;
        },

        animateToSelectedItem: function() {
          this.animateToItem( this.getSelectedItemIndex() );
        },

        animateToItem: function( intItemIndex ) {
          var fltPercentagePerItem = this.getPercentagePerItem(),
              fltPercentage = intItemIndex * fltPercentagePerItem;

          this.animateToPercentage( fltPercentage );
        },

        animateToPercentage: function( fltPercentage ) {
          if( this.$sliderHandle ) {
            if( Modernizr.csstransitions ) {
              this.$sliderHandle.css( 'left', fltPercentage + '%' ),
              this.$sliderBarIndicator.width( fltPercentage + '%' );
            } else {
              this.$sliderHandle.stop( true ).velocity(
                {
                  left: fltPercentage + '%'
                }, 200
              ),
              this.$sliderBarIndicator.stop( true ).velocity(
                {
                  width: fltPercentage + '%'
                }, 200
              );
            }
          }
        },

        restoreUserAnswers: function() {
          if( this.model.get( '_isSubmitted' ) ) {
            var selectedItem = {},
                items = this.model.get( '_items' ),
                userAnswer = this.model.get( '_userAnswer' );

            for( var i = 0, l = items.length; i < l; i++ ) {
              var item = items[i];

              if( item.value == userAnswer ) {
                item._isSelected = true;
                selectedItem = item;
                this.model.set( '_selectedItem', selectedItem );
                this.selectItem( item.value );
                this.animateToSelectedItem();
                break;
              }
            }

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
            this.destroyDragables();
          }
        },

        // Used by question to disable the question during submit and complete stages
        disableQuestion: function() {
          this.destroyDragables();
          this.$sliderWidget.addClass( 'disabled' );
        },

        // Used by question to enable the question during interactions
        enableQuestion: function() {
          this.setupDragables();
          this.$sliderWidget.removeClass( 'disabled' );
        },

        //Use to check if the user is allowed to submit the question
        canSubmit: function() {
          return true;
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {},

        //This preserve the state of the users answers for returning or showing the users answer
        storeUserAnswer: function() {
          this.destroyDragables();
          this.model.set( '_userAnswer', this.model.get( '_selectedItem' ).value );
        },

        // this return a boolean based upon whether to question is correct or not
        isCorrect: function() {
          if( this.model.get( '_selectedItem' ).correct ) {
            this.model.set( '_numberOfCorrectAnswers', 1 );
            this.model.set( '_isAtLeastOneCorrectSelection', 1 );
            return true;
          } else {
            this.model.set( '_numberOfCorrectAnswers', 0 );
            this.model.set( '_isAtLeastOneCorrectSelection', 0 );
            return false;
          }
        },

        // Used to set the score based upon the _questionWeight
        setScore: function() {
          var numberOfCorrectAnswers = this.model.get( '_numberOfCorrectAnswers' ),
              questionWeight = this.model.get( '_questionWeight' );

          this.model.set( '_score', questionWeight * numberOfCorrectAnswers );
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
          this.destroyDragables();
          this.$sliderWidget.removeClass( 'correct incorrect' ).addClass( 'show-marking ' + ( this.isCorrect() ? 'correct' : 'incorrect' ) );
        },

        // Used by the question to determine if the question is incorrect or partly correct
        isPartlyCorrect: function() {
          return this.model.get( '_isAtLeastOneCorrectSelection' );
        },

        // Used by the question view to reset the stored user answer
        resetUserAnswer: function() {
          this.model.set(
            {
              _selectedItem: {},
              _userAnswer: undefined
            }
          );
        },

        getCorrectAnswer: function() {
          var intAnswer = this.model.get( '_correctAnswer' ) || '',
              objRange = this.model.get( '_correctRange' ) || {},
              intStart = this.model.get( '_scaleStart' ),
              intEnd = this.model.get( '_scaleEnd' ),
              intStep = this.model.get( '_scaleStep' ) || 1,
              fltCorrectValue = ( ( intAnswer !== '' ) ? intAnswer : ( ( objRange._top + objRange._bottom ) / 2 ) );

          return fltCorrectValue;
        },

        getValuePercetage: function( intValue ) {
          var intAnswer = this.model.get( '_correctAnswer' ) || '',
              objRange = this.model.get( '_correctRange' ) || {},
              intStart = this.model.get( '_scaleStart' ),
              intEnd = this.model.get( '_scaleEnd' ),
              intStep = this.model.get( '_scaleStep' ) || 1;

          return ( ( intValue - intStart ) / ( intEnd - intStart ) ) * 100;
        },

        // Used by the question to display the correct answer to the user
        showCorrectAnswer: function() {
          var intAnswer = this.model.get( '_correctAnswer' ) || '',
              objRange = this.model.get( '_correctRange' ) || {};

          this.animateToPercentage( this.getValuePercetage( this.getCorrectAnswer() ) );

          if( intAnswer !== '' ) {
            this.setHandleText( intAnswer + ( this.model.get( '_scaleLabel' ) || '' ) );
          } else {
            this.setHandleText( objRange._bottom + '-' + objRange._top + ( this.model.get( '_scaleLabel' ) || '' ), true );
          }
        },

        // Used by the question to display the users answer and
        // hide the correct answer
        // Should use the values stored in storeUserAnswer
        hideCorrectAnswer: function() {
          this.animateToSelectedItem();
          this.setHandleItemText();
        },

        // Used by the question view to reset the look and feel of the component.
        // This could also include resetting item data
        resetQuestion: function() {
          this.selectItem( 0 );
          this.animateToSelectedItem();
        },

        // this should reset the selected state of each item
        deselectAllItems: function() {
          _.each(
            this.model.get( '_items' ),
            function( item ) {
              item.selected = false;
            },
            this
          );
        }
      }
    );

    Adapt.register( 'slider', Slider );

    return Slider;
  }
);